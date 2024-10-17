const express = require('express');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB Connection URI
const client = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Endpoint to handle multipart/form-data
app.post('/upload', upload.single('fingerprint'), async (req, res) => {
    try {
        // Connect to the MongoDB database
        await client.connect();
        const database = client.db('designsbyese');
        const collection = database.collection('sample');

        // Prepare data to insert
        const sampleData = {
            image: req.file.buffer, // Store image as Buffer
            quality: req.body.quality,
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

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
