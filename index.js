const express = require('express');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { spawn } = require('child_process')
const bodyParser = require('body-parser');
const app = express();
require('dotenv').config();
const path = require('path')
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
};



// Middleware

app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Setup multer for handling multiple fields
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Setup CORS to handle preflight requests for all routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Allow preflight for all routes

// MongoDB Connection URI
const client = new MongoClient(process.env.MONGODB_URI);

// Endpoint to handle multipart/form-data
app.post('/upload', upload.fields([{ name: 'profilePhoto', maxCount: 1 }]), async (req, res) => {
    try {
        await client.connect();
        const database = client.db('designsbyese');
        const collection = database.collection('samples');

        const profilePhotoBuffer = req.files['profilePhoto'] ? req.files['profilePhoto'][0].buffer : null;
        let fingerprintBuffer;
        if (req.body.fingerprintImage) {
            const base64Data = req.body.fingerprintImage.replace(/^data:image\/\w+;base64,/, "");
            fingerprintBuffer = Buffer.from(base64Data, 'base64');
        } else {
            fingerprintBuffer = null;
        }

        const sampleData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            middleName: req.body.middleName,
            profilePhoto: profilePhotoBuffer,
            fingerprintImage: fingerprintBuffer,
            uploadedAt: new Date(),
        };

        const result = await collection.insertOne(sampleData);
        res.status(200).json({ message: 'Sample uploaded successfully', id: result.insertedId });
    } catch (error) {
        console.error('Error uploading sample:', error);
        res.status(500).json({ message: 'Error uploading sample', error: error.message });
    } finally {
        await client.close();
    }
});



app.post('/validatefingerprint', upload.single('imageFile'), async (req, res) => {
    const { image } = req.body;

    if (!image) {
        return res.status(400).json({ message: 'No fingerprint image provided.' });
    }

    try {
        // Convert base64 image to Buffer
        const imageBuffer = Buffer.from(image, 'base64');

        // Connect to MongoDB
        await client.connect();
        const database = client.db('designsbyese');
        const collection = database.collection('samples');

        // Retrieve stored fingerprints
        const fingerprints = await collection.find({}, { projection: { firstName: 1, lastName: 1, middleName: 1, profilePhoto: 1, fingerprintImage: 1 } }).toArray();

        if (fingerprints.length === 0) {
            return res.status(404).json({ message: 'No fingerprints found in the database.' });
        }

        // Write the uploaded fingerprint image buffer to a temporary file
        const imagePath = path.join(__dirname, 'temp_fingerprint.png');
        fs.writeFileSync(imagePath, imageBuffer);

        // Prepare fingerprint images for the Python script
        const fingerprintImages = fingerprints.map(f => f.fingerprintImage);

        // Run the Python script
        const pythonProcess = spawn('python', ['opencv.py', JSON.stringify(fingerprintImages), imagePath]);

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
                const result = JSON.parse(dataFromPython);

                if (result.matchIndex === -1) {
                    return res.status(404).json({ message: 'No fingerprint match found.' });
                }

                const matchedUser = fingerprints[result.matchIndex];

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

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data}`);
        });

    } catch (error) {
        console.error('Error validating fingerprint:', error);
        return res.status(500).json({ message: 'Error validating fingerprint. Please try again.' });
    } finally {
        await client.close();
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
