const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const schedule = require('node-schedule');

const app = express();
const port = 3079;

const secretKey = 'alpha';
const apiKey = 'admin';
const mongoUrl = 'mongodb://localhost:27017'; // Update with your MongoDB connection string
const dbName = 'pasteDB';
const collectionName = 'pastes';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());

const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongo() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        process.exit(1);
    }
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decrypt(encrypted) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), Buffer.from(encrypted.iv, 'hex'));
    let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

app.all('/paste', async (req, res) => {
    try {
        const apiKeyParam = req.query.apikey;
        if (apiKeyParam !== apiKey) {
            return res.status(403).send('Invalid API key');
        }

        const content = req.query.content || req.body.content;
        if (!content) {
            return res.status(400).send('Content is required');
        }

        const { iv, encryptedData } = encrypt(content);

        const pasteData = {
            _id: uuidv4(),
            iv: iv,
            encryptedData: encryptedData,
            createdAt: new Date()
        };

        await client.db(dbName).collection(collectionName).insertOne(pasteData);

        const result = {
            author: 'cipher',
            id: `alpha~${pasteData._id}`
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error posting:', error.message);
        res.status(500).send('Error pasting text');
    }
});

app.get('/retrieve/:pasteId', async (req, res) => {
    const userPasteId = req.params.pasteId;
    const internalPasteId = userPasteId.replace(/^alpha~/, '');

    try {
        const apiKeyParam = req.query.apikey;
        if (apiKeyParam !== apiKey) {
            return res.status(403).send('Invalid API key');
        }

        const pasteData = await client
            .db(dbName)
            .collection(collectionName)
            .findOne({ _id: internalPasteId });

        if (!pasteData) {
            return res.status(404).send('Paste not found');
        }

        const result = {
            author: 'cipher',
            id: userPasteId,
            content: pasteData.encryptedData,
            iv: pasteData.iv
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving:', error.message);
        res.status(404).send('Paste not found');
    }
});

schedule.scheduleJob('0 0 */3 * *', async () => {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        await client
            .db(dbName)
            .collection(collectionName)
            .deleteMany({ createdAt: { $lt: threeDaysAgo } });

        console.log('Old pastes deleted');
    } catch (error) {
        console.error('Error deleting old pastes:', error.message);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    connectToMongo();
});
