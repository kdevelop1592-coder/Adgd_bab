const admin = require('firebase-admin');
const serviceAccount = require('./adgd-bab-firebase-adminsdk-fbsvc-56691a83c0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    console.log("Checking DB...");
    const users = await db.collection('users').get();
    console.log('Users count:', users.size);
    let tokenCount = 0;
    users.forEach(doc => {
        if(doc.data().token) tokenCount++;
    });
    console.log('Users with tokens:', tokenCount);

    const config = await db.collection('admin_config').doc('notifications').get();
    if(config.exists) {
        console.log('Config:', config.data());
    } else {
        console.log('No admin_config found.');
    }
}

check().catch(console.error);
