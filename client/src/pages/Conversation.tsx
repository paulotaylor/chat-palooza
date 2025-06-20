import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import PCMPlayer from 'pcm-player';
import { useNavigate, useLocation, useBlocker } from 'react-router-dom';

import { Buffer } from 'buffer';
import { 
  Alert,
  Box, 
  Button,
  CircularProgress,
  IconButton,
  Typography,
  Paper,
  Divider,
  Fab,
} from '@mui/material';
import { 
  Delete,
  Save,
  Download, 
  PlayArrow, 
  PlayArrow as PlayArrowIcon,
  Home,
  ThumbUpAlt,
  ThumbDownAlt,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ConversationStyle, PaloozaConversation, Persona, TranscriptEntry } from '../types/data';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

type ConversationState = {
  personas: Persona[];
  style?: any;
  topic?: string;
  isLive?: boolean;
  transcript?: TranscriptEntry[];
  url?: string;
  conversation?: PaloozaConversation;
};

const cachedConversations = new Map<string, PaloozaConversation>();

const Conversation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [time, setTime] = useState(new Date());
  const updateInterval = useRef<NodeJS.Timeout | undefined>(undefined);

  const state = location.state as ConversationState;
  const [personaA, personaB] = state?.personas || [];
  // PCMPlayer instances for each persona
  const pcmPlaybackRef = useRef<PCMPlayer>(null);
  const pcmPlayerARef = useRef<PCMPlayer>(null);
  const pcmPlayerBRef = useRef<PCMPlayer>(null);
  // for url playing
  const conversationRef = useRef<PaloozaConversation | null>(state?.conversation || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sampleRate = useRef<number>(16000);
  const [isDone, setIsDone] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [inProgress, setInProgress] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{path?: string, state?: any, retry?: () => void} | null>(null);

  const isBlocking = useRef(true);
  const blocker = useBlocker(
    useCallback(
      ({ }) => (inProgress || !isSaved) && (state?.isLive === true),
      [inProgress, isSaved]
    )
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowExitDialog(true);
    }
  }, [blocker]);
  
  const isPlayerPlaying = useRef(false);
  const isMounted = useRef(false);

  // PCMPlayer config
  const pcmConfig = {
    encoding: '16bitInt',
    channels: 1,
    sampleRate: 16000,
    flushTime: 100,
    inputCodec: 'Int16' as const,
    fftSize: 2048 as const,
    onended: () => {
      console.log('Player ended');
      isPlayerPlaying.current = false;
    }
  };

  // Streaming transcription buffers
  const transcriptionBufferA = useRef('');
  const transcriptionBufferB = useRef('');
  const transcriptionIdB = useRef('');
  const transcriptionIdA = useRef('');
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState('');

  interface AudioBlob {
    persona: Persona;
    blob: Blob;
    timestamp: number;
    conversationId: string;
  }

  // Store real-time transcripts and audio for both participants
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  // Store audio blobs for later upload
  const [audioBlobs, setAudioBlobs] = useState<AudioBlob[]>([]);

  // Helper to add transcript entry
  const addTranscript = (speakerId: string, text: string, id: string) => {
    setTranscripts(prev => {
      // find endtry with id
      const index = prev.findIndex(entry => entry.id === id);
      if (index !== -1) {
        // update entry
        const newPrev = [...prev];
        newPrev[index] = { ...prev[index], text };
        return newPrev;
      }
      return [
        { speakerId, text, timestamp: Date.now(), id },
        ...prev,
      ];
    });
  };

  /**
   * Starts the time update interval to allow the component to update periodically.
   * Used to update the transcription progress while the conversation is live
   */
  const startInterval = () => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }
    updateInterval.current = setInterval(() => {
      setTime(new Date());
    }, 1000);
  }

  /**
   * Stops the time update interval.
   */
  const stopInterval = () => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = undefined;
    }
  }

  /**
   * Closes all PCMPlayers
   */
  const closePlayers = () => {
    console.log('Closing players');
    pcmPlayerARef.current && pcmPlayerARef.current.destroy();
    pcmPlayerBRef.current && pcmPlayerBRef.current.destroy();
    pcmPlaybackRef.current && pcmPlaybackRef.current.destroy();
    audioRef.current && audioRef.current.pause();
    audioRef.current = null;
    pcmPlayerARef.current = null;
    pcmPlayerBRef.current = null;
    pcmPlaybackRef.current = null;
    console.log('Players closed');
  }
  
  // Session refs
  const connection = useRef<WebSocket | null>(null)

  // --- Message Handling ---
  const handleMessage = (data: string) => {

    if (!isMounted.current) {
      console.debug('Component unmounted, discarding message', data);
      return;
    }
    // parse message
    const message = JSON.parse(data);
    // handle message
    if (message.type === "sessionStart") {
      setStatus('');
      console.debug('Session started', message);
      // start interval to uodate the component periodically
      startInterval();
      // get media type
      const type = message.mediaType;
      if (type.startsWith("audio/pcm")) { // currently only supports pcm
        // get sample rate
        sampleRate.current = parseInt(type.split(";")[1].split("=")[1]);
      } else {
        sampleRate.current = 16000;
      }
      const cfg = {...pcmConfig, sampleRate: sampleRate.current};
      // create PCMPlayer instance for playback
      pcmPlaybackRef.current = new PCMPlayer(cfg);
      pcmPlaybackRef.current.volume(1.0);
      // create PCMPlayer instances for each persona
      pcmPlayerARef.current = new PCMPlayer(cfg);
      pcmPlayerARef.current.volume(1.0);
      pcmPlayerBRef.current = new PCMPlayer(cfg);
      pcmPlayerBRef.current.volume(1.0)

      setIsDone(false);
      setInProgress(true);
      setIsStopping(false);
      return;
    }

    if (message.type === "sessionEnd") {
      console.debug('Session ended', message);
      stopInterval()
      setIsDone(true);
      setInProgress(false);
      return;
    }

    if (message.type === "transcript") {
      console.debug('Transcript', message);
      const text = message.text;
      // update current persona
      if (currentPersona?.id !== message.personaId) {
        setCurrentPersona(getPersona(message.personaId));
      }
      // update current transcription id
      if (currentTranscriptionId !== message.transcriptionId) {
        setCurrentTranscriptionId(message.transcriptionId);
      }
      // Accumulate delta into corresponding buffer
      if (message.personaId === personaA.id) {
        transcriptionBufferA.current = text;
        transcriptionIdA.current = message.transcriptionId;
        console.log('Output transcription', message.personaId, message, transcriptionIdA.current, transcriptionBufferA.current);
        addTranscript(personaA.id, transcriptionBufferA.current, transcriptionIdA.current);
      } else if (message.personaId === personaB.id) {
        transcriptionBufferB.current = text;
        transcriptionIdB.current = message.transcriptionId;
        console.log('Output transcription', message.personaId, message, transcriptionIdB.current, transcriptionBufferB.current);
        addTranscript(personaB.id, transcriptionBufferB.current, transcriptionIdB.current);
      }
      return;
    }
    // handle error message      
    if (message.type === "error") {
      console.error('Received error', message.error);
      setError(message.error);
      stopInterval()
      setIsDone(true);
      setInProgress(false);
      return;
    }
    
    // handle media message
    if (message.type === "media") {
      const data = message.data as string;
      if (!data) {
        console.log('Received empty audio', message);
        return;
      }
      console.debug('Received audio', message.personaId, data.length);
      // convert base64 audio data to buffer
      const buffer = Buffer.from(data, 'base64');
      // Feed to corresponding PCMPlayer
      if (message.personaId === personaA.id) {
        if (pcmPlayerARef.current) {
          pcmPlayerARef.current.feed(buffer.buffer);
        }
        setAudioBlobs(prev => [...prev, {persona: personaA, conversationId: message.transcriptionId, timestamp: Date.now(), blob: new Blob([buffer])}]);
      }
      if (message.personaId === personaB.id) {
        if (pcmPlayerBRef.current) {
          pcmPlayerBRef.current.feed(buffer.buffer);
        }
        setAudioBlobs(prev => [...prev, {persona: personaB, conversationId: message.transcriptionId, timestamp: Date.now(), blob: new Blob([buffer])}]);
      }
      return;
    }
    console.log('Received unhandled websocket message', message);

  };
  

  const startConversation = () => {
    // --- Websocket Setup ---
    // Defensive: always close previous sessions

    setAudioBlobs([]);
    setTranscripts([]);
    setCurrentPersona(null);
    setCurrentTranscriptionId('');
    setInProgress(false);
    setIsStopping(false);
    setIsDone(false);
    setError('');
    setStatus('');
    setIsSaved(false);

    transcriptionBufferA.current = '';
    transcriptionBufferB.current = '';
    transcriptionIdA.current = crypto.randomUUID();
    transcriptionIdB.current = crypto.randomUUID();
    
    if (connection.current) {
      connection.current.close();
      connection.current = null
      console.debug('Cleaning up previous Session A');
    }
    // fetch user token
    currentUser?.getIdToken().then(token => {
      console.debug('User token', token);
      if (!isMounted.current) {
        console.debug('not mounted, not sending start');
        return;
      }

      // build websocket url
      let url = process.env.REACT_APP_WEBSOCKET_URL;
      if (url) {
        url = url + '/client/socket';
      } else {
        url = window.location.origin.replace('http', 'ws') + '/client/socket';
      }

      setStatus('Connecting to server...');
      console.debug('WebSocket URL:', url);
      // connect to websocket
      const socket = new WebSocket(`${url}?token=${token}`);
      connection.current = socket;
      socket.onopen = () => {
        console.debug('ws client connected');
        if (!isMounted.current) {
          console.debug('not mounted, not starting');
          socket.close();
          return;
        }
        console.debug('mounted, starting');
        setStatus('Starting conversation...');
        // start message
        const start = {
          type: "start",
          personas: [personaA, personaB],
          topic: state?.topic,
          style: state?.style
        }
        // this seems to fix some timing issues in development
        // since useEffect() is called twice
        setTimeout(() => {
          if (!isMounted.current) {
            console.debug('not mounted, not sending start');
            socket.close();
            return;
          }
          console.debug('Sending start', start);
          socket.send(JSON.stringify(start));
        }, 500);
      };
      socket.onmessage = (event) => {
        // handle message
        handleMessage(event.data);
      };
      socket.onclose = (event) => {
        console.debug('ws client closed', event);
        stopInterval();
        setIsDone(true);
        setIsStopping(false);
        setInProgress(false);
      };
      socket.onerror = (event) => {
        console.error('push ws client error ' + event.type, event);
      };
    });
  }

  useEffect(() => {

    if (!state?.topic) {
      // get id from location
      const id = location.pathname.split('/').pop();
      if (id) {
        const c = cachedConversations.get(id);
        if (c) {
          navigate('/conversation/' + id, { state: {
            topic: c.topic,
            personas: c.personas,
            style: c.style,
            transcript: c.transcript,
            isLive: false,
            conversation: c
          }});
          return;
        }
        // load conversation from firestore
        const ref = doc(db, 'conversations', id);
        getDoc(ref).then((doc) => {
          if (doc.exists()) {
            const conversation = doc.data() as PaloozaConversation;
            conversationRef.current = conversation;
            cachedConversations.set(id, conversation);
            navigate('/conversation/' + id, { state: {
              topic: conversation.topic,
              personas: conversation.personas,
              style: conversation.style,
              transcript: conversation.transcript,
              isLive: false,
              conversation: conversation
            }});
          } else {
            navigate('/');
          }
        });
      }

      navigate('/');
      return;
    }

    isMounted.current = true;

    if (state?.isLive) {
      setTimeout(() => {
        if (!isMounted.current) {
          console.debug('not mounted, not starting');
          return;
        }
        startConversation();        
      }, 500);
    } else {
      setTranscripts(state?.transcript || []);
      setIsDone(true);
      setInProgress(false);
      setIsStopping(false);
      const cfg = {...pcmConfig, sampleRate: 16000};
      // create PCMPlayer instance for playback
      pcmPlaybackRef.current = new PCMPlayer(cfg);
      pcmPlaybackRef.current.volume(1.0);

    }

    return () => {
      isMounted.current = false;
      stopInterval();
      setIsDone(true);
      setIsStopping(false);
      closePlayers();
      closeSession();
    };
  }, [personaA?.id, personaB?.id]);

  // --- Helper Functions ---
  const getAvatarClass = (personaId: string) => {
    if (inProgress && personaId === currentPersona?.id) {
      return 'avatar pulse';
    }
    return 'avatar';
  }
  /**
   * Closes the websocket connection and resets the component state
   */
  const closeSession = () => {
    setCurrentPersona(null);
    setInProgress(false);
    setIsStopping(false);
    connection.current?.close();
  };
  /**
   * Sends a stop message to the websocket connection
   */
  const handleStopConversation = () => {
    setIsStopping(true);
    connection.current?.send(JSON.stringify({ type: "stop" }));
  };
  /**
   * Sends a close message to the websocket connection and closes the session
   */
  const handleAbort = () => {
    connection.current?.send(JSON.stringify({ type: "close" }));
    closeSession()
    closePlayers();
  };
  /**
   * Returns a buffer containing the audio of the conversation
   */
  const getConversationAudioBuffer = async () => {
    let finalBuffer = Buffer.from([]);
    let previousPersona = null;
    for (const blob of audioBlobs) {
      if (previousPersona && previousPersona !== blob.persona) {
        // Add silence buffer of 1 second (sample rate * bytes per sample * channels)
        const silenceDurationSec = 0.5; // 1 second
        const sampleRate = 24000;
        const bytesPerSample = 2; // PCM 16-bit
        const channels = 1;
        const silenceBuffer = Buffer.alloc(sampleRate * bytesPerSample * channels * silenceDurationSec, 0);
        finalBuffer = Buffer.concat([finalBuffer, silenceBuffer]);
      }
      const buffer = await blob.blob.arrayBuffer();
      finalBuffer = Buffer.concat([finalBuffer, Buffer.from(buffer)]);
      previousPersona = blob.persona;
    };
    return finalBuffer;
  }
  /**
   * Returns a buffer containing the audio of the conversation for a specific transcript
   */
  const getTranscriptAudioBuffer = async (transcriptid: string) => {
    let finalBuffer = Buffer.from([]);
    for (const blob of audioBlobs) {
      if (blob.conversationId !== transcriptid) continue;
      const buffer = await blob.blob.arrayBuffer();
      finalBuffer = Buffer.concat([finalBuffer, Buffer.from(buffer)]);
    };
    return finalBuffer;
  }

  const playFromUrl = async (url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    isPlayerPlaying.current = true;
  }

  /**
   * Plays the conversation audio
   */
  const handlePlay = async () => {
    if (isPlayerPlaying.current) {
      audioRef.current?.pause();
      audioRef.current = null;
      pcmPlaybackRef.current?.pause();
      pcmPlaybackRef.current?.destroy();
      pcmPlaybackRef.current = null;
      isPlayerPlaying.current = false;
      return;
    }
    const cfg = {...pcmConfig, sampleRate: sampleRate.current || 16000 };
    pcmPlaybackRef.current = new PCMPlayer(cfg);
    pcmPlaybackRef.current.volume(1.0);

    if (state.url) {
      playFromUrl(state.url);
    } else {
      isPlayerPlaying.current = true;
      const finalBuffer = await getConversationAudioBuffer();
      pcmPlaybackRef.current?.feed(finalBuffer.buffer);
    }
  };
  /**
   * Downloads the conversation audio
   */
  const handleDownload = async () => {

    if (state?.url) {
      window.open(state.url, '_blank');
      return;
    }      

    const finalBuffer = await waveFile();
    const blob = new Blob([finalBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation_' + Date.now() + '.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  /**
   * Plays the audio of a specific transcript
   */
  const handlePlayTranscript = async (transcriptionId: string) => {
    if (!pcmPlaybackRef.current) return;
    if (isPlayerPlaying.current) {
      pcmPlaybackRef.current?.destroy();
      isPlayerPlaying.current = false;
      setCurrentTranscriptionId('');
      stopInterval();
      return;
    }
    setCurrentTranscriptionId(transcriptionId);
    startInterval();
    const cfg = {...pcmConfig, sampleRate: sampleRate.current};
    pcmPlaybackRef.current = new PCMPlayer(cfg);
    pcmPlaybackRef.current.volume(1.0);
    isPlayerPlaying.current = true;
    const finalBuffer = await getTranscriptAudioBuffer(transcriptionId);
    pcmPlaybackRef.current?.feed(finalBuffer.buffer);
  };  
  /**
   * Deletes a specific transcript
   */
  const handleDelete = async (transcriptionId: string) => {
    setAudioBlobs(audioBlobs.filter(blob => blob.conversationId !== transcriptionId));
    setTranscripts(transcripts.filter(transcript => transcript.id !== transcriptionId));
  };

  const apiURL = process.env.REACT_APP_API_URL || '';

  const handleUpvote = async () => {
    if (!conversationRef.current) return;
    
    const conversation = conversationRef.current;

    const token = await currentUser?.getIdToken() || '';
    
    fetch(apiURL + '/api/conversation/' + conversation.id + '/upvote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      if (data?.error) {
        console.error('Downvote failed:', data.error)
        setError(data.error)
        return;
      }
      if (data?.upvotes) {
        conversation.upvotes = data.upvotes || 0;
        conversation.downvotes = data.downvotes || 0;
        conversationRef.current = conversation;
        setTime(new Date());
        setStatus('Upvoted Conversation!');

      } else {
        console.error('Upvote failed:', data)
      }
    })
    .catch(error => {
      console.error('Upvote failed:', error);
    });
  };

  const handleDownvote = async () => {
    if (!conversationRef.current) return;
    
    const conversation = conversationRef.current; 
    
    const token = await currentUser?.getIdToken() || '';
    
    fetch(apiURL + '/api/conversation/' + conversation.id + '/downvote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      if (data?.error) {
        console.error('Downvote failed:', data.error)
        setError(data.error);
        return;
      }
      if (data?.downvotes) {
        conversation.upvotes = data.upvotes || 0;
        conversation.downvotes = data.downvotes || 0;
        conversationRef.current = conversation;
        setTime(new Date());
        setStatus('Downvoted Conversation!');
      } else {
        console.error('Downvote failed:', data)
      }
    })
    .catch(error => {
      console.error('Downvote failed:', error);
    });
  };  


  const waveFile = async () => {
    const pcmBuffer = await getConversationAudioBuffer();

    // WAV file format details
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate.current * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const chunkSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    buffer.writeUInt16LE(channels, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate.current, 24); // SampleRate
    buffer.writeUInt32LE(byteRate, 28); // ByteRate
    buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
  };


  const getSummary = async ({ personas, topic, transcript, style }: { personas: Persona[], topic: string, transcript: TranscriptEntry[], style: ConversationStyle }) => {
    const apiURL = process.env.REACT_APP_API_URL || '';
    return fetch( apiURL + '/api/conversation/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personas: personas,
        topic: topic,
        transcripts: transcript,
        style: style
      })
    })  
    .then(res => res.json())
    .then(data => {
      console.log(data);
      return data?.summary || '';
    })
    .catch(error => {
      console.error('Summary failed:', error);
      setStatus('');
      setError('Failed to get summary: ' + error.message);
      return '';
    });
  }
  

  /**
   * Saves the conversation audio to Firebase
   */
  const handleSave = async () => {
    if (!pcmPlaybackRef.current) return;

    setStatus('Uploading audio, please wait...');
    setError('');
    setIsSaved(true); // disable save button

    const id = location.pathname.split('/').pop();

    const buffer = await waveFile();
    // Save the file
    const blob = new Blob([buffer], { type: 'audio/wav' });

    // save the blob to Firebase Storage
    const storageRef = ref(storage, `conversations/${crypto.randomUUID()}.wav`);
    const uploadTask = uploadBytesResumable(storageRef, blob);
    uploadTask.then(snapshot => {
      console.log('Upload complete', snapshot.ref);

      getDownloadURL(snapshot.ref).then(downloadURL => {
        console.log('Download URL:', downloadURL);

        getSummary({
          topic: state.topic || '',
          personas: state.personas,
          style: state.style,
          transcript: transcripts,
        }).then(summary => {
          console.log('Summary:', summary);
          // save the conversation to Firebase
          const conversation: PaloozaConversation = {
            id: id || crypto.randomUUID(),
            userId: currentUser?.uid || '',
            topic: state.topic || '',
            personas: state.personas.map(p => p.id),
            style: state.style,
            audio_url: downloadURL,
            transcript: transcripts,
            summary: summary,
            upvotes: 0,
            downvotes: 0,
            created_at: Timestamp.fromDate(new Date()),
            isStarred: false
          };
          const conversationRef = doc(db, 'conversations', conversation.id);
          setDoc(conversationRef, conversation).then(() => {
            setStatus('Conversation saved successfully');
            console.log('Conversation saved to Firebase');
          }).catch(error => {
            setError('Failed to save conversation: ' + error.message);
            setStatus('');
            console.error('Save conversation failed:', error);
            setIsSaved(false);
          });
        }).catch(error => {
          setError('Failed to get summary: ' + error.message);
          setStatus('');
          console.error('Summary failed:', error);
          setIsSaved(false);
        });
      })
    }).catch(error => {
      setError('Failed to upload audio: ' + error.message);
      setStatus('');
      console.error('Upload failed:', error);
      setIsSaved(false);
    });

  };


  // Get persona by ID
  const getPersona = (id: string): Persona => {
    const persona = personaA.id === id ? personaA : personaB;
    if (!persona) {
      // Return a default persona with the provided ID if not found
      return {
        id,
        name: 'Unknown',
        description: 'Unknown persona',
        avatar_url: '',
        category: 'casual' as const
      };
    }
    return persona;
  };

  /**
   * Calculates the transcription progress for a given entry
   */
  function calculateTranscriptionProgress(entry: TranscriptEntry): number | undefined {
    // calculate duration of audio blob
    const blob = audioBlobs.filter(b => b.conversationId === entry.id);
    if (!blob || blob.length === 0) {
      return undefined;
    }
    // calculate size of all  blobs
    const size = blob.reduce((acc, b) => acc + b.blob.size, 0);
    const duration = size / (sampleRate.current * 2);
    const start = entry.timestamp;
    const end = start + (duration * 1000);
    const now = Date.now();
    const progress = ((now - start) / (duration * 1000)) * 100;
    return progress;
  }
  
  /**
   * Checks if a given entry is the current transcription
   */
  function isCurrentTranscription(entry: TranscriptEntry): boolean {
    return entry.id === currentTranscriptionId;
  }

  // Exit dialog
  // Render this above the main return
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, width: '100%', marginTop: 0 }}>
      <Typography variant="h4" gutterBottom>
        {state?.isLive ? 'Live Palooza Conversation' : 'Palooza Conversation'}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        {state?.topic ? `Topic: ${state.topic}` : 'No topic specified'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 6, mb: 4 }}>
        {personaA && personaB && [personaA, personaB].map((persona, idx) => (
          <Paper key={persona.id} sx={{ p: 3, minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 6, flex: '1 1 0' }} elevation={6}>
            <img className={getAvatarClass(persona.id)} width="72" height="72" src={persona.avatar_url} alt={persona.name} /> 
            <Typography variant="h6">{persona.name}</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              {persona.description}
            </Typography>

          </Paper>
        ))}
      </Box>
      {inProgress && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CircularProgress size={24} color="primary" />
        <Typography variant="body1">Conversation in progress...</Typography>
      </Box>
      )}
      {inProgress && (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, width: '100%', marginTop: 0 }}>
        { isStopping && 
        <Typography sx={{ mb: 2 }} variant="body2">Waiting for conversation to stop...</Typography>
        }
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleStopConversation}
                  disabled={isStopping}
                  sx={{ minWidth: 180 }}
                >
                  {isStopping ? 'Stopping...' : 'Stop'}
                </Button>
                { isStopping && (<Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleAbort}
                  sx={{ minWidth: 180 }}
                >
                  Abort
                </Button>)}
        </Box>
      </Box>
      )}
      {status && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {status}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}


      {isDone && transcripts.length > 0 && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                { state?.isLive && <Fab
                  variant="extended"
                  color="primary"
                  aria-label="save"
                  title='Save Conversation'
                  onClick={handleSave}
                  disabled={isSaved}
                  sx={{ margin: 1 }}
                >
                  <Save/>
                </Fab>
                }
                <Fab
                  variant="extended"
                  color="primary"
                  aria-label="play"
                  title='Play Conversation'
                  onClick={handlePlay}
                  sx={{ margin: 1 }}
                >
                  <PlayArrow/>
                </Fab>
                <Fab
                  variant="extended"
                  color="primary"
                  aria-label="download"
                  title='Download Conversation'
                  onClick={handleDownload}
                  sx={{ margin: 1 }}
                >
                  <Download/>
                </Fab>
                <Fab
                  variant="extended"
                  color="primary"
                  aria-label="home"
                  title='Back to Home'
                  onClick={() => navigate('/', {state})}
                  sx={{ margin: 1 }}
                >
                  <Home/>
                </Fab>
                { conversationRef.current && currentUser?.uid !== conversationRef.current?.userId &&
                <Fab
                  variant="extended"
                  color="primary"
                  aria-label="download"
                  title='Upvote Conversation'
                  onClick={handleUpvote}
                  sx={{ margin: 1 }}
                >
                  <ThumbUpAlt/>&nbsp;{conversationRef.current?.upvotes || 0}
                </Fab>
                }
                { conversationRef.current && currentUser?.uid !== conversationRef.current?.userId &&
                <Fab
                  variant="extended"
                  color="primary"
                  aria-label="home"
                  title='Downvote Conversation'
                  onClick={handleDownvote}
                  sx={{ margin: 1 }}
                >
                  <ThumbDownAlt/>&nbsp;{conversationRef.current?.downvotes || 0}
                </Fab>
                }
      </Box>
      )}
      <Divider sx={{ width: '100%', mb: 2 }} />
      <Box sx={{ width: '100%', maxWidth: 700, bgcolor: '#f9f9f9', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {state?.isLive && inProgress ? 'Real-time Transcriptions' : 'Transcript'}
        </Typography>
        {transcripts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Waiting for AI conversation...</Typography>
        ) : (
          transcripts.map((entry, idx) => (
            <Paper key={entry.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 6, flex: '1 1 0', mb: 2}} elevation={2}>
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <img className={'avatar'} width="28" height="28" src={getPersona(entry.speakerId)?.avatar_url}/>
              <Typography variant="body2" sx={{ width: '100%'}}><b>{getPersona(entry.speakerId)?.name}:</b> {entry.text}</Typography>
              { inProgress && isCurrentTranscription(entry) && (
                <CircularProgress size={20} variant="determinate" value={calculateTranscriptionProgress(entry) || 0} />
              )}
              { isDone && state?.isLive && (
                <IconButton
                  color="primary"
                  size="small"
                  onClick={() => handlePlayTranscript(entry.id)}
                >
                  <PlayArrowIcon />
                </IconButton>
                )}
              { isDone && state?.isLive && (
                <IconButton
                  color="primary"
                  size="small"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Delete/>
                </IconButton>
                )}
            </Box>
            </Paper>
          ))
        )}
      </Box>
      <Dialog open={showExitDialog} onClose={() => setShowExitDialog(false)}>
        <DialogTitle>Exit Conversation?</DialogTitle>
        <DialogContent>
          <Typography>{inProgress ? 'There is a conversation in progress. Are you sure you want to exit? All progress will be lost.' : 'This conversation has not been saved, All progress will be lost'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExitDialog(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              setShowExitDialog(false);
              setInProgress(false);
              blocker.proceed?.();
            }}
          >
            Exit
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
)};

export default Conversation;

// Add avatar class styling for circular images
const style = document.createElement('style');
style.innerHTML = `
.avatar { border-radius: 50%; vertical-align: middle; }
@keyframes gelatine {
  from, to { transform: scale(1, 1); }
  25% { transform: scale(0.9, 1.1); }
  50% { transform: scale(1.1, 0.9); }
  75% { transform: scale(0.95, 1.05); }
}
.gelatine {
  animation: gelatine 0.5s infinite;
}
.pulse {
  animation: pulse 0.3s infinite ease-in-out alternate;
}
@keyframes pulse {
  from { transform: scale(0.8); }
  to { transform: scale(1.1); }
}`;
document.head.appendChild(style);

