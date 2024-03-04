const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = 3078; 

const secretKey = 'alpha';
const apiKey = 'admin';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());

function encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', secretKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encrypted) {
    const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
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

        const encryptedText = encrypt(content);

        const response = await axios.post('https://paste.c-net.org/', encryptedText);

        const pasteID = response.data.split('/').pop();
        res.status(200).send(pasteID);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error pasting text');
    }
});

app.get('/retrieve/:pasteId', async (req, res) => {
    const pasteId = req.params.pasteId;
    try {
        const apiKeyParam = req.query.apikey;
        if (apiKeyParam !== apiKey) {
            return res.status(403).send('Invalid API key');
        }

        const response = await axios.get(`https://paste.c-net.org/${pasteId}`);
        const decryptedText = decrypt(response.data);
        res.status(200).send(decryptedText);
    } catch (error) {
        console.error(error);
        res.status(404).send('Paste not found');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
