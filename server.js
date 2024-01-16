const express = require('express');
const mysqlUtils = require('./mysqlUtils');
const app = express();
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const RabbitMQ = require('./rabbitmq');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');

app.use(express.json());

const port = 1010;

const cors = require('cors');
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


app.post('/api/insert-donor', upload.single('image'), async (req, res) => {
  const { donorName, bloodType, city, town, phoneNumber, userId } = req.body;

  const image = req.file;

  try {
      if (image) {
        const connectionString = 'DefaultEndpointsProtocol=https;AccountName=iremsustorage;AccountKey=xdhwi9fHF9fVV7Q0G+ZGrfCDgXHjWG/voaEW/GpgkVIURASjae+p53VeA/Uo9cXwXwzQm+Bj+5fM+AStWz5wQw==;EndpointSuffix=core.windows.net';

          const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
          const containerName = 'donorphotos'; 
          const blobName = `${userId}_${Date.now()}_${image.originalname}`;
          const containerClient = blobServiceClient.getContainerClient(containerName);
          const blockBlobClient = containerClient.getBlockBlobClient(blobName);

          await blockBlobClient.uploadData(image.buffer, {
              blobHTTPHeaders: {
                  blobContentType: image.mimetype,
              },
          });

          const cdnHostName = 'donorphotos-gkh3a5b0bahka6gw.z02.azurefd.net'; // CDN konak adı
          const imageUrl = `https://${cdnHostName}/${blobName}`;

          await mysqlUtils.insertNewDonor(
              donorName,
              bloodType,
              city,
              town,
              phoneNumber,
              userId,
              imageUrl,
          );

          res.json({ success: true, message: 'Data added successfully' });
      } else {
          throw new Error('Image file not found');
      }
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'An error occurred while processing the request' });
  }
});



app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { userId } = await mysqlUtils.branchValid(username, password);

    console.log("Login Result - userId:", userId);

    if (userId) {
      res.json({ success: true, message: 'Login successful', userId });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An error occurred while processing the request' });
  }
});



app.post('/api/find-branchname', async (req, res) => {
  const { userId } = req.body;

  try {
    const { branchName } = await mysqlUtils.findBranchName(userId);

    if (branchName !== null && branchName !== undefined) {
      console.log(branchName);
      res.json({ branchName });
    } else {
      console.error('Error finding branchName: Branch name is null or undefined.');
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } catch (error) {
    console.error('Error finding branchName:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/api/fetch-donors', async (req, res) => {
  const { userId, page = 1, pageSize = 5 } = req.body;

  try {
    const donorInformation = await mysqlUtils.getPaginatedDonors(userId, page, pageSize);

    if (donorInformation) {
      res.json({ donorInformation });
    } else {
      res.status(404).json({ error: 'Donors not found' });
    }
  } catch (error) {
    console.error('Error fetching donors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/api/delete-donor', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required for deletion.' });
    }

    await mysqlUtils.deleteDonor(phoneNumber);

    res.json({ message: 'Donor deleted successfully.' });
  } catch (error) {
    console.error('Error deleting donor:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
    } else {
      console.error('Error object:', error);
    }

    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post("/api/fetch-donors-with-name", async (req, res) => {
  try {
    const { userId, donorName } = req.body;

    console.log(userId, donorName);

    if (!userId || !donorName) {
      return res.status(400).json({ error: 'Donor name and userId are required for fetch operation.' });
    }

    const donorInformation = await mysqlUtils.fetchDonorsName(userId, donorName);

    if (donorInformation) {
      console.log("info", donorInformation);
      res.json({donorInformation });
    } else {
      res.status(404).json({ error: 'Donors not found' });
    }
  } catch (error) {
    console.error('Error fetching donors with name:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.post('/api/set-blood-units', async (req, res) => {
  try {
    const { iddonor, unitsOfBlood } = req.body;

    if (!iddonor || !unitsOfBlood) {
      return res.status(400).json({ error: 'iddonor and unitsOfBlood are required.' });
    }

    await mysqlUtils.setBloodUnits(iddonor, unitsOfBlood);

    res.json({ success: true, message: 'Blood units set successfully.' });
  } catch (error) {
    console.error('Error setting blood units:', error);
    res.status(500).json({ success: false, message: 'An error occurred while processing the request.' });
  }
});



app.post('/api/request-blood', async (req, res) => {
  try {
      const { selectedCity, selectedTown, bloodType, duration, email, units, reason } = req.body;

      const result = await mysqlUtils.searchBlood(selectedCity, selectedTown, bloodType, units);

      if (result === 'successful') {
          res.json({ message: 'Successful' });
          const emailResult = await sendEmail(email);

          console.log(emailResult);

      } else if (result === 'rabbitmq') {
          console.log('Not enough blood units. Sending to RabbitMQ...');

          const message = {
              email,
              selectedCity,
              selectedTown,
              bloodType,
              duration,
              units,
              reason,
          };

          await RabbitMQ(message);

          res.json({ message: 'Not enough blood units. Sending to RabbitMQ...' });
      } else {
          res.status(500).json({ error: 'Internal Server Error' });
      }
  } catch (error) {
      console.error('Error processing blood request:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


const sendEmail = async (to) => {
  const msg = {
    to : to,
    from: {
      name: 'Health Organization',
      email: 'iremsuikl@hotmail.com'
    },
    subject: "Blood Request",
    text: "The requested blood type  found",
  };

  try {
    await sgMail.send(msg) ;
    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};





app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

