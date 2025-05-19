const { google } = require('googleapis');

async function getGoogleContacts() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/contacts.readonly']
    });

    const service = google.people({ version: 'v1', auth });
    
    const response = await service.people.connections.list({
      resourceName: 'people/me',
      pageSize: 2000,
      personFields: 'names,phoneNumbers'
    });

    const contacts = response.data.connections || [];
    
    return contacts
      .map(contact => {
        const name = contact.names?.[0]?.displayName || 'Sin nombre';
        const phoneNumber = contact.phoneNumbers?.[0]?.value || '';
        
        return {
          name: name,
          number: phoneNumber.replace(/\D/g, '') // Elimina caracteres no numéricos
        };
      })
      .filter(contact => contact.number.length >= 8); // Filtra números inválidos

  } catch (error) {
    console.error('Error obteniendo contactos:', error.message);
    return [];
  }
}

module.exports = { getGoogleContacts };