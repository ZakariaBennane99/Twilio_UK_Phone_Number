require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');


const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const app = express();
const targetWhatsAppNumber = process.env.TARGET_WHATSAPP_NUMBER;



app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  const messageText = req.body.Body;
  const fromNumber = req.body.From;

  try {
    await client.messages.create({
      body: `AN SMS FROM ${fromNumber}: ${messageText}`,
      from: 'whatsapp:+14155238886',
      to: targetWhatsAppNumber,
    });

    console.log(`Forwarded SMS from ${fromNumber} to ${targetWhatsAppNumber}`);
  } catch (error) {
    console.error(`Failed to forward SMS from ${fromNumber}: ${error.message}`);
  }

  const twiml = new twilio.twiml.MessagingResponse();
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// Add this new route to handle incoming calls
app.post('/call', (req, res) => {

  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say(
    {
      voice: 'Polly.Amy',
    },
    `We are currently unavailable, please leave a voice message after the beep`);

  // Record the message
  twiml.record({
    action: '/process_speech',
    timeout: 10,
    transcribe: false, // Disable Twilio transcription
  });

  // Add a say prompt for cases when no input is received
  twiml.say(
    {
      voice: 'Polly.Amy',
    },
    'We did not receive any input. Goodbye!');

  // Send the response
  res.type('text/xml');
  res.send(twiml.toString());

});



app.post('/process_speech', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const recordingUrl = req.body.RecordingUrl;
  const fromNumber = req.body.From;

  try {
    // Forward the voice message URL to WhatsApp
    const message = await client.messages.create({
      body: `VOICE MESSAGE FROM ${fromNumber}: ${recordingUrl}`,
      from: 'whatsapp:+14155238886', // Replace with your Twilio WhatsApp Sandbox number
      to: targetWhatsAppNumber,
    });

    if (message.errorCode) {
      console.error(`Failed to forward voice message: ${message.errorMessage}`);
      twiml.say(    {
        voice: 'Polly.Amy',
      },
      'We encountered an error while forwarding your message. Goodbye!');
    } else {
      console.log(`Forwarded voice message from ${fromNumber} to ${targetWhatsAppNumber}`);
      twiml.say(    {
        voice: 'Polly.Amy',
      },
      'Your message has been forwarded. Goodbye!');
    }
  } catch (error) {
    console.error(`Failed to forward voice message from ${fromNumber}: ${error.message}`);
    twiml.say(    {
      voice: 'Polly.Amy',
    },
    'We encountered an error while forwarding your message. Goodbye!');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
