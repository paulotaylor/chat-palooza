// Basic Express server for serving React frontend and API endpoints
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import path from 'path';


import express, { Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';
import { getPersonas } from './personas';
import { ConversationStyle, Persona, TranscriptEntry, ConversationRequest } from '../../client/src/types/data';
const PORT = process.env.PORT || 5001;
import expressWs from 'express-ws';
import { admin } from './firebase';

const { app } = expressWs(express(), undefined, {
  wsOptions: {
      maxPayload: 1024 * 1024 * 5,
  }
});

import cors from 'cors';
import { getUserToken } from './utils';
import { ConversationSession, AudioBuffer, getStyles } from './conversation';
import { completeRequest, GeminiLiveConversationSession } from './gemini';
app.use(cors({ origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API endpoints
app.get('/api/personas', (req: Request, res: Response) => {
  res.json({personas: getPersonas()});
});

app.get('/api/styles', (req: Request, res: Response) => {
  res.json({styles: getStyles()});
});

const topics = JSON.parse(process.env.POPULAR_TOPICS || '[]');
console.debug('Popular topics', topics);

app.get('/api/topics', (req: Request, res: Response) => {
  res.json({topics});
});

app.post('/api/conversation/:id/upvote', async (req: Request, res: Response) => {
  const id = req.params.id;
  const token = getUserToken(req);
  if (!token) {
      res.status(401).send('Unauthorized');
      return;
  }
  const uid = (await admin.auth().verifyIdToken(token)).uid;
  if (!uid) {
      res.status(401).send('Unauthorized');
      return;
  }

  try {

    const db = admin.firestore();

    db.runTransaction(async (transaction) => {

      // check if conversation exists

      const docRef = db.collection('conversations').doc(id);
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
          res.status(404).send('Conversation not found');
          return;
      }
      const data = doc.data();
      if (!data) {
          res.status(404).send('Conversation not found');
          return;
      }

      if (data.userId === uid) {
        res.status(400).json({ error: 'Cannot upvote your own conversation' });
        return;
      }

      let upvotes = data.upvotes || 0;
      let downvotes = data.downvotes || 0;

      // check if user already voted
      const upvotesRef = db.collection('votes').where('conversationId', '==', id).where('userId', '==', uid);
      const upvotesSnapshot = await upvotesRef.get();
      if (!upvotesSnapshot.empty) {
        // check if vote is upvote or downvote
        const vote = upvotesSnapshot.docs[0].data();
        await transaction.delete(upvotesSnapshot.docs[0].ref);
        if (vote.upvote) {
          // delete vote
          upvotes = Math.max(upvotes - 1, 0);
        } else {
          // delete vote
          downvotes = Math.max(downvotes - 1, 0);
        }
      }

      // update upvotes
      await transaction.set(await db.collection('votes').add({
          conversationId: id,
          userId: uid,
          upvote: true,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
      }), null, {});
      upvotes++;
      await transaction.update(docRef, { upvotes, downvotes });
      res.json({ result: { upvotes, downvotes } });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }

});

app.post('/api/conversation/:id/downvote', async (req: Request, res: Response) => {
  const id = req.params.id;
  const token = getUserToken(req);
  if (!token) {
      res.status(401).send('Unauthorized');
      return;
  }
  const uid = (await admin.auth().verifyIdToken(token)).uid;
  if (!uid) {
      res.status(401).send('Unauthorized');
      return;
  }

  const db = admin.firestore();

  try {
   db.runTransaction(async (transaction) => {
      // check if conversation exists
      const docRef = db.collection('conversations').doc(id);
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
          res.status(404).send('Conversation not found');
        return;
      }
      const data = doc.data();
      if (!data) {
          res.status(404).send('Conversation not found');
          return;
      }

      if (data.userId === uid) {
        res.status(400).json({ error: 'Cannot downvote your own conversation' });
        return;
      }

      let upvotes = data.upvotes || 0;
      let downvotes = data.downvotes || 0;

      // check if user already voted
      const downvotesRef = db.collection('votes').where('conversationId', '==', id).where('userId', '==', uid);
      const downvotesSnapshot = await downvotesRef.get();
      if (!downvotesSnapshot.empty) {
        const vote = downvotesSnapshot.docs[0].data();
        // delete vote
        await transaction.delete(downvotesSnapshot.docs[0].ref);
        if (vote.upvote) {
          // delete vote
          upvotes = Math.max(upvotes - 1, 0);
        } else {
          // delete vote
          downvotes = Math.max(downvotes - 1, 0);
        }
      }

      // update downvotes
      await transaction.set(await db.collection('votes').add({
        conversationId: id,
        userId: uid,
        upvote: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }), null, {});
      
      downvotes++;
      await transaction.update(docRef, { upvotes, downvotes });
      res.json({ result: { upvotes, downvotes } });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/api/conversation/summary', (req: Request, res: Response) => {
  const transcripts = req.body.transcripts as TranscriptEntry[];
  const topic = req.body.topic as string;
  const style = req.body.style as ConversationStyle;
  const personas = req.body.personas as Persona[];


  const getPersona = (id: string) => {
    return personas.find((p) => p.id === id);
  };


  const request = `Summarize in a sentence the conversation between ${personas[0].name} and ${personas[1].name} on the topic ${topic}. The conversation is as follows: ${transcripts.reverse().map((t) => {
    return `${getPersona(t.speakerId)?.name}: ${t.text}`;
  }).join('\n')}`;

  completeRequest(request).then((summary) => {
    res.json({summary});
  }).catch((error) => {
    res.json({error: error.message});
  });
});

const staticPath = path.join(__dirname, '../../client/build');
console.log('Serving static files from', staticPath);
// Serve static files from React build
app.use(express.static(staticPath));

/**
 * Client websocket endpoint to send push messages
 */
app.ws('/client/socket', async function (ws, req) {
  const token = getUserToken(req);
  if (!token) {
      ws.close(3000, 'Invalid token');
      return;
  }
  let uid;
  let session: ConversationSession | undefined;
  try {
      uid = (await admin.auth().verifyIdToken(token)).uid;

      if (!uid) {
          console.error('User not found');
          ws.close(3000, 'User not found');
          return;
      }
  } catch (e: any) {
      console.error('Error authenticating user', e);
      ws.close(3000, e.message);
      return
  }

  ws.on('error', async function (error) {
      console.error('client ws client error ' + error.message, error);
  });

  const handleMessage = (msg: any) => {
    console.log('incoming client ws client message ' + JSON.stringify(msg));
    const data = JSON.parse(msg);
    if (data.type === 'stop') {
      session?.stop();
      return;
    }
    if (data.type === 'close') {
      session?.close();
      ws.close();
      return;
    }
    if (data.type === 'start') {
      const { personas, topic, style } = data;
      console.debug('conversation start', personas, topic, style);
      const p1 : Persona = personas[0];
      const p2 : Persona = personas[1];
      const s : ConversationStyle = style;

      // validate parameters
      if (!p1 || !p2 || !s || !topic) {
        console.debug('Invalid parameters', p1, p2, s, topic);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid parameters'}));
        ws.close();
        return;
      }
      if (p1.description.length === 0 || p1.name.length === 0 || p2.description.length === 0 || p2.name.length === 0) {
        console.debug('Invalid personas', p1, p2);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid personas'}));
        ws.close();
        return;
      }
      if (p1.description.length > 250 || p1.name.length > 50 || p2.description.length > 250 || p2.name.length > 50) {
        console.debug('Invalid personas', p1, p2);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid personas'}));
        ws.close();
        return;
      }
      if (topic.length === 0) {
        console.debug('Invalid topic', topic);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid topic'}));
        ws.close();
        return;
      }
      if (topic.length > 250) {
        console.debug('Invalid topic', topic);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid topic'}));
        ws.close();
        return;
      }
      if (style.description.length === 0 || style.name.length === 0) {
        console.debug('Invalid style', style);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid style'}));
        ws.close();
        return;
      }
      if (style.description.length > 250 || style.name.length > 50) {
        console.debug('Invalid style', style);
        ws.send(JSON.stringify({type: 'error', error: 'Invalid style'}));
        ws.close();
        return;
      } 

      const request : ConversationRequest = {personas: [p1, p2], topic: topic, style: s};

      session = new GeminiLiveConversationSession( {
        onTranscriptEntry: (entry: TranscriptEntry) => {
          console.debug('transcript entry', entry);
          ws.send(JSON.stringify({
            type: 'transcript', 
            personaId: entry.speakerId, 
            transcriptionId: entry.id,
            text: entry.text
          }));
        },
        onAudioBuffer: (audioBuffer: AudioBuffer) => {
          console.debug('audio buffer', audioBuffer);
          ws.send(JSON.stringify({
            type: 'media', 
            personaId: audioBuffer.personaId, 
            transcriptionId: audioBuffer.transcriptionId,
            data: audioBuffer.buffer.toString('base64'), 
            mediaType: audioBuffer.mediaType}));
        },
        onError: (error: string) => {
          console.error('error', error);
          ws.send(JSON.stringify({type: 'error', error: error}));
        },
        onSessionEnd: () => {
          console.debug('session end');
          ws.send(JSON.stringify({type: 'sessionEnd'}));
          ws.close();
        },
        onSessionStart: () => {
          console.debug('session start');
          ws.send(JSON.stringify({type: 'sessionStart', mediaType: session?.mediaType}));
        }
      }, request);
      session?.start()
    }
  };

  //an event listener is set up for incoming WebSocket messages.
  ws.on('message', async function (msg) {
    try {
      handleMessage(msg);
    } catch(e: any) {
      console.error('Error handling message', e);
      ws.send(JSON.stringify({type: 'error', error: e.message}));
    }
  });
  ws.on('close', async function () {
      console.log('client ws closed');
      session?.close();
  });
  console.log('client ws-socket connected');
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});