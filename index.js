const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = 3079;

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

        console.log('Posting to pastebin service...');
        const response = await axios.post('https://paste.c-net.org/', encryptedText);

        console.log('Paste response:', response.data);

        const pasteID = response.data.split('/').pop();
        const result = {
            author: 'cipher',
            id: `alpha~${pasteID}`
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error posting:', error.message);
        res.status(500).send('Error pasting text');
    }
});

app.get('/retrieve/:pasteId', async (req, res) => {
    const userPasteId = req.params.pasteId;
    const internalPasteId = userPasteId.replace(/^alpha~/, ''); // Remove 'alpha~' prefix
    try {
        const apiKeyParam = req.query.apikey;
        if (apiKeyParam !== apiKey) {
            return res.status(403).send('Invalid API key');
        }

        console.log('Retrieving from pastebin service...');
        const response = await axios.get(`https://paste.c-net.org/${internalPasteId}`);
        
        console.log('Retrieved paste:', response.data);
        const result = {
            author: 'cipher',
            id: userPasteId,
            content: response.data
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving:', error.message);
        res.status(404).send('Paste not found');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});


/*{ usage : 
getpaste: /retrieve/PASTE_ID?apikey=admin
paste:  /paste?content=YourContent&apikey=admin  }*/
