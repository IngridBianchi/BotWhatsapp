require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = [process.env.GOOGLE_SCOPES];
const TOKEN_PATH = 'token.json';
const credentialClientId = process.env.GOOGLE_CLIENT_ID;
console.log('credentialClientId',credentialClientId);

function loadCredentials(callback) {
    const credentials = {
        installed: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
        }
    };
    console.log('loadCredentials -> credentials',credentials);
    authorize(credentials, callback);
}

function authorize(credentials, codeOrCallback, maybeCallback) {
    const { client_id, client_secret, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        // Si codeOrCallback es función, es callback
        const callback = typeof codeOrCallback === 'function' ? codeOrCallback : maybeCallback;
        callback(oAuth2Client);
    } else if (typeof codeOrCallback === 'string') {
        // El código se pasó directamente
        oAuth2Client.getToken(codeOrCallback, (err, token) => {
            if (err) return console.error('❌ Error al obtener el token:', err);
            oAuth2Client.setCredentials(token);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            console.log('✅ Token guardado en', TOKEN_PATH);
            maybeCallback(oAuth2Client);
        });
    } else {
        // Si no hay token ni código, pedimos código por consola
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('👉 Autoriza esta aplicación visitando esta URL:\n', authUrl);
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        readline.question('\n🔐 Pega aquí el código que te dio Google: ', (code) => {
            readline.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return console.error('❌ Error al obtener el token:', err);
                oAuth2Client.setCredentials(token);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                console.log('✅ Token guardado en', TOKEN_PATH);
                maybeCallback(oAuth2Client);
            });
        });
    }
} 

 async function listContacts(auth) {
    const service = google.people({ version: 'v1', auth });
    let contacts = [];
    let nextPageToken = null;

    do {
        const res = await service.people.connections.list({
            resourceName: 'people/me',
            pageSize: 1000,
            personFields: 'names,phoneNumbers',
            pageToken: nextPageToken,
        });

        const connections = res.data.connections || [];

        const newContacts = connections.map(person => {
            const name = person.names?.[0]?.displayName || 'Sin nombre';
            const number = person.phoneNumbers?.[0]?.value.replace(/\D/g, '');
            return number ? { name, number } : null;
        }).filter(Boolean);

        contacts = contacts.concat(newContacts);
        nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);

    fs.writeFileSync('contacts.json', JSON.stringify(contacts, null, 2));
    console.log(`✅ Se guardaron ${contacts.length} contactos en contacts.json`);

    return contacts;
}
 
async function getGoogleContacts(code) {
    try {
        const credentials = {
            installed: {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
            }
        };
        console.log('credentials',credentials);
        return new Promise((resolve, reject) => {
            authorize(credentials, code, async (auth) => {
                try {
                    const contacts = await listContacts(auth);
                    resolve(contacts);
                } catch (error) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error obteniendo contactos:', error.message);
        return [];
    }
}

module.exports = { getGoogleContacts, loadCredentials, authorize, listContacts };
