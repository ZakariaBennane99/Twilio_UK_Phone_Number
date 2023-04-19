require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const FormData = require('form-data');
openai.apiKey = proecess.env.OPENAI_API_KEY


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
      body: `Forwarded SMS from ${fromNumber}: ${messageText}`,
      from: '+14155238886',
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

    twiml.record({
      action: '/process_speech',
      timeout: 10,
      transcribe: false, // Disable Twilio transcription
    })
    .say("Please leave a message after the beep.")

    twiml.say('We did not receive any input. Goodbye!');
    res.type('text/xml');
    res.send(twiml.toString());
});



app.post('/process_speech', async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const recordingUrl = req.body.RecordingUrl;
    const fromNumber = req.body.From;

    try {
      // Fetch the audio file from Twilio
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'audio/mpeg' },
      });

      // Save the audio file locally
      const audioFilePath = 'audio.mp3';
      fs.writeFileSync(audioFilePath, Buffer.from(response.data, 'binary'));

      // Create a form data object
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioFilePath));

      // Send the audio file to OpenAI's Whisper ASR
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
            Authorization: `Bearer ${openai.apiKey}`,
          },
          params: { model: 'whisper-1' },
        }
      );

      // Get the transcription result from OpenAI's Whisper ASR
      const speechResult = openaiResponse.data.data.transcript;

      // Forward the transcribed message to WhatsApp
      await client.messages.create({
        body: `Voice message from ${fromNumber}: ${speechResult}`,
        from: 'whatsapp:+14155238886', // Replace with your Twilio WhatsApp Sandbox number
        to: targetWhatsAppNumber,
      });

      console.log(`Forwarded voice message from ${fromNumber} to ${targetWhatsAppNumber}`);
      twiml.say('Your message has been forwarded. Goodbye!');
    } catch (error) {
      console.error(`Failed to forward voice message from ${fromNumber}: ${error.message}`);
      twiml.say('We encountered an error while forwarding your message. Goodbye!');
    }

    // Remove the locally saved audio file
    fs.unlinkSync(audioFilePath);

    res.type('text/xml');
    res.send(twiml.toString());
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
