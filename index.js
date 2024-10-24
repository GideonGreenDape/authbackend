const express = require('express');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { spawn } = require('child_process')
const app = express();
require('dotenv').config();
const path = require('path')
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB Connection URI
const client = new MongoClient(process.env.MONGODB_URI);

// Endpoint to handle multipart/form-data
app.post('/upload', upload.single('profilePhoto'), async (req, res) => {
    try {
        // Connect to the MongoDB database
        await client.connect();
        const database = client.db('designsbyese');
        const collection = database.collection('samples');

        // Decode the base64 string
        const base64Data = req.body.fingerprintImage.replace(/^data:image\/png;base64,/, "");
        const fingerprintBuffer = Buffer.from(base64Data, 'base64');

        // Prepare data to insert
        const sampleData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            middleName: req.body.middleName,
            profilePhoto: req.file.buffer, // Store image as Buffer
            fingerprintImage: fingerprintBuffer, // Store fingerprint image as Buffer
            uploadedAt: new Date(),
        };

        // Insert data into MongoDB
        const result = await collection.insertOne(sampleData);
        console.log('Sample data stored:', result);

        // Send response
        res.status(200).json({ message: 'Sample uploaded successfully', id: result.insertedId });
    } catch (error) {
        console.error('Error uploading sample:', error);
        res.status(500).json({ message: 'Error uploading sample', error: error.message });
    } finally {
        // Close the MongoDB connection
        await client.close();
    }
});


app.post('/validatefingerprint', async (req, res) => {
    const { image } = req.body;

    if (!image) {
        return res.status(400).json({
            message: 'No fingerprint image provided.',
        });
    }

    // Fetch stored fingerprints from MongoDB
    try {
        await client.connect();
        const database = client.db('designsbyese');
        const collection = database.collection('samples');

        // Retrieve all fingerprints and user data
        const fingerprints = await collection.find({}, { projection: { firstName: 1, lastName: 1, middleName: 1, profilePhoto: 1, fingerprintImage: 1 } }).toArray();

        if (fingerprints.length === 0) {
            return res.status(404).json({ message: 'No fingerprints found in the database.' });
        }

        // Write the uploaded fingerprint image to a temporary file
        const imagePath = path.join(__dirname, 'temp_fingerprint.png');
        fs.writeFileSync(imagePath, image, 'base64'); // Assuming the image is base64 encoded

        // Prepare an array of fingerprint images for Python
        const fingerprintImages = fingerprints.map(f => f.fingerprintImage);

        // Spawn a child process to run the Python script
        const pythonProcess = spawn('python', ['opencv.py', JSON.stringify(fingerprintImages), imagePath]);

        // Capture output from the Python script
        let dataFromPython = '';

        pythonProcess.stdout.on('data', (data) => {
            dataFromPython += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Python process exited with code ${code}`);
                return res.status(500).json({ message: 'Error during fingerprint validation.' });
            }

            try {
                // Parse the response from the Python script
                const result = JSON.parse(dataFromPython);

                // Check if a match was found
                if (result.matchIndex === -1) {
                    return res.status(404).json({ message: 'No fingerprint match found.' });
                }

                // Retrieve the matching user document from MongoDB
                const matchedUser = fingerprints[result.matchIndex];

                // Respond with matched user details
                return res.json({
                    message: 'Fingerprint match',
                    firstName: matchedUser.firstName,
                    lastName: matchedUser.lastName,
                    middleName: matchedUser.middleName,
                    profilePicture: matchedUser.profilePhoto,
                    matchPercentage: result.matchPercentage,
                });

            } catch (error) {
                console.error('Error parsing Python output:', error);
                return res.status(500).json({ message: 'Error parsing fingerprint match result.' });
            }
        });

        // Capture any errors from the Python process
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data}`);
            return res.status(500).json({ message: 'Error during fingerprint validation.' });
        });

    } catch (error) {
        console.error('Error validating fingerprint:', error);
        return res.status(500).json({ message: 'Error validating fingerprint. Please try again.' });
    } finally {
        // Ensure to close MongoDB connection if needed, or handle it elsewhere
        await client.close();
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
