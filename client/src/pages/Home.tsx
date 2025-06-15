import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Container, 
  Typography, 
  Paper, 
  TextField, 
  Card, 
  CardContent,
  CardActionArea,
  Tabs,
  Tab,
  IconButton,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Autocomplete,
  Alert,
  InputAdornment,
  FilledInput,
  FormControl,
  InputLabel,
  OutlinedInput,
  Divider,
  Snackbar,
  ButtonGroup
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { styled } from '@mui/material/styles';
import { Close, Mic as MicIcon, Send as SendIcon, ThumbDownAlt, ThumbUpAlt } from '@mui/icons-material';
import { ConversationStyle, PaloozaConversation, Persona } from '../types/data';
import { getAnalytics, logEvent } from "firebase/analytics";
import { collection, getDocs,query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getPersona, getPersonas } from '../services/personas';
import { getStyles, getTopics } from '../services/conversations';
import { signInAnonymously } from 'firebase/auth';

// Styled Components
const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  padding: theme.spacing(8, 0),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  marginBottom: theme.spacing(6),
  textAlign: 'center',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-8px)',
  },
}));

const Home = () => {
  const location = useLocation();
  const [topic, setTopic] = useState('');
  const [conversationsMode, setConversationsMode] = useState('last');
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [popularTopics, setPopularTopics] = useState<string[]>([]);
  const [styles, setStyles] = useState<ConversationStyle[]>([]);
  const [conversations, setConversations] = useState<PaloozaConversation[]>([]);
  
  const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<ConversationStyle | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const conversationsLimit = 12;

  const apiURL = process.env.REACT_APP_API_URL || '';

  const loadMostUpvotedConversations = async () => {
    setIsLoading(true);

    setToastMessage('Loading conversations...');

    // load most upvoted conversations from Firebase    
    const conversationsRef = collection(db, 'conversations');
    const querySnapshot = await getDocs(query(conversationsRef, orderBy('upvotes', 'desc'), limit(conversationsLimit)));
    const conversations: PaloozaConversation[] = querySnapshot.docs.map(doc => {
      const conversation = doc.data() as PaloozaConversation;
      return conversation;        
    });
    setConversationsMode("upvoted")
    setConversations(conversations);
    setToastMessage('');
    setIsLoading(false);
  };

    // load conversations from Firebase
  const loadLastConversations = async () => {
    setIsLoading(true);

    setToastMessage('Loading conversations...');

    // load last conversations from Firebase    
    const conversationsRef = collection(db, 'conversations');
    const querySnapshot = await getDocs(query(conversationsRef, orderBy('created_at', 'desc'), limit(conversationsLimit)));
    const conversations: PaloozaConversation[] = querySnapshot.docs.map(doc => {
      const conversation = doc.data() as PaloozaConversation;
      return conversation;        
    });
    setConversationsMode("last")
    setConversations(conversations);
    setToastMessage('');
    setIsLoading(false);
  };

  useEffect(() => {    

    loadLastConversations();

    if (location.state?.topic) {
      setTopic(location.state.topic);
    }

    getPersonas().then(personas => {
      console.log(personas);
      setPersonas(personas);
      if (location.state?.personas) {
        setSelectedPersonas(location.state.personas);
      } else if (personas.length > 0) {
        setSelectedPersonas(getRandomElements(personas, 2));
      }
    }).catch(err => {
      console.log(err);
      setError('Error loading personas: ' + err.message);
    });

    getTopics().then(topics => {
      console.log(topics);
      setPopularTopics(topics);
      setTopics(getRandomElements(topics, 5));
    });
    getStyles().then(styles => {
      console.log(styles);
      setStyles(styles);
      if (location.state?.style) {
        setSelectedStyle(location.state.style);
      } else if (styles.length > 0) {
        setSelectedStyle(styles[0])
      }
    }).catch(err => {
      console.log(err);
      setError('Error loading styles: ' + err.message);
    });
  }, []);

  function getRandomElements(arr: Array<any>, numElements: number) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return [];
    }
  
    if (numElements === 0) {
      return [];
    }
  
    // Create a copy of the array to avoid modifying the original
    const shuffledArr = [...arr];
    // Shuffle the array using Fisher-Yates algorithm
    for (let i = shuffledArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArr[i], shuffledArr[j]] = [shuffledArr[j], shuffledArr[i]];
    }
  
    // Take the first 'numElements' from the shuffled array
    return shuffledArr.slice(0, numElements);
  }

  const handleStartConversation = () => {
    if (!topic.trim()) {
      setError('Topic is required');
      return;
    }
    if (selectedPersonas.length === 0) {
      setError('At least two personas are required');
      return;
    }
    if (!selectedStyle) {
      setError('A conversation style is required');
      return;
    }
    setError('');
    setIsLoading(true);
    logEvent(getAnalytics(), 'start_conversation');        
    setTimeout(() => {
      if (!currentUser) {
        // signin anonymously
        signInAnonymously(auth).then(() => {
          console.log('User signed in anonymously');
          gotoConversation();
        }).catch((error) => {
          console.error('Error signing in anonymously:', error);
          setIsLoading(false);
          setError(error.message);
        });
      } else {
        gotoConversation()
      }

    }, 1000);
  };

  const gotoConversation = () => {
    setIsLoading(false);
    const newConversationId = crypto.randomUUID();
    navigate(`/conversation/${newConversationId}`, {
      state: {
        topic,
        personas: selectedPersonas,
        style: selectedStyle,
        isLive: true,
        isNew: true
      }
    });
}
    

  const features = [
    {
      title: 'Choose Personas',
      description: 'Select from a variety of AI personas with unique personalities and knowledge bases.',
      icon: '🎭',
    },
    {
      title: 'Set the Topic',
      description: 'Provide a topic to guide the conversation.',
      icon: '📝',
    },
    {
      title: 'Pick a Style',
      description: 'Choose how your AI personas interact - casual chat, debate, podcast, and more!',
      icon: '🎙️',
    },
  ];
  const formatDate = (time: Timestamp) => {
    if (!time) return 'unknown';
    const now = new Date();
    const date = time.toDate();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today ' + date.toLocaleTimeString();
    } else if (diffInDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString();
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago ${date.toLocaleTimeString()}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  function handleConversationClick(conversation: PaloozaConversation): void {
    navigate(`/conversation/${conversation.id}`, {
      state: {
        topic: conversation.topic,
        personas: conversation.personas,
        style: conversation.style,
        transcript: conversation.transcript,
        isLive: false,
        conversation,
      },
    });
  }

  return (
    <Container maxWidth="lg">
      <HeroSection>
        <Container maxWidth="md">
          <Typography 
            variant={isMobile ? 'h4' : 'h3'} 
            component="h2" 
            gutterBottom 
            sx={{ 
              fontWeight: 'bold',
              color: '#086f95',
              mb: 3,
              lineHeight: 1.2
            }}
          >
            Create AI-Powered Conversations
          </Typography>
          <Typography variant={isMobile ? 'h6' : 'h5'} color="textSecondary" paragraph sx={{ mb: 4 }}>
            Bring AI personas to life with realistic, engaging, and entertaining conversations on any topic.
          </Typography>
          
          <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: 'auto', borderRadius: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <FormControl variant="outlined">
            <InputLabel htmlFor="topic">Topic</InputLabel>
              <OutlinedInput
                id="topic"
                label="Topic"
                fullWidth
                value={topic}
                onChange={e => setTopic(e.target.value)}
                endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setTopic('')}
                  edge="end"
                >
                  <Close />
                </IconButton>
              </InputAdornment>
            }
              />
            </FormControl>
              { topic.length == 0 && (<Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Try these topics:
                </Typography>
                <Box sx={{ display: 'flex', mb: 3, flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {topics.map((topic, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="small"
                      onClick={() => setTopic(topic)}
                      sx={{ borderRadius: 4, textTransform: 'none' }}
                    >
                      {topic}
                    </Button>
                  ))}
                </Box>
              </Box>)}

                <Autocomplete<Persona, true, false, false>
                  multiple
                  limitTags={2}
                  options={personas.filter(p => p.hidden !== true)}
                  value={selectedPersonas}
                  onChange={(_, value) => {
                    if (value.length > 2) {
                      setSelectedPersonas(value.slice(0, 2));
                    } else {
                      setSelectedPersonas(value);
                    }
                  }}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                        <img className='avatar' src={option.avatar_url} alt={option.name} width="48" height="48" />
                        <Box sx={{ ml: 1 }}><Typography variant="body1" color="textSecondary" fontWeight="bold">{option.name}</Typography><Typography variant="body2" color="textSecondary">{option.description}</Typography>
                        {option.personality_traits && option.personality_traits.length > 0 && <Typography variant="body2" color="textSecondary">{option.personality_traits.join(', ')}</Typography>}
                        </Box>
                      </Box>
                    </li>
                  )}
                  getOptionLabel={option => option.name}
                  renderInput={params => (
                    <TextField {...params} variant="outlined" label="Select Two Personas" placeholder="Personas" />
                  )}
                  sx={{ mb: 1 }}
                  disableCloseOnSelect
                />
                <Autocomplete<ConversationStyle, false, false, false>
                  options={styles}
                  value={selectedStyle}
                  onChange={(_, value) => setSelectedStyle(value)}
                  getOptionLabel={option => option ? option.name : ''}
                  renderInput={params => (
                    <TextField {...params} variant="outlined" label="Conversation Style" placeholder="Style" />
                  )}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleStartConversation}
                  disabled={isLoading}
                  sx={{ minWidth: 180 }}
                >
                  {isLoading ? 'Starting...' : 'Start'}
                </Button>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
      
            
            {currentUser?.isAnonymous !== false && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center' }}>
                <Button 
                  color="primary" 
                  onClick={() => navigate('/auth')}
                  size="small"
                >
                  Sign up
                </Button>
                {' '}to save your conversations and access history
              </Typography>
            )}

          </Paper>
        </Container>
      </HeroSection>

      <Box sx={{ mb: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ButtonGroup variant="outlined" aria-label="Conversations mode" sx={{ mb: 2, justifyContent: 'center' }}>
            <Button sx={{ width: '150px' }} onClick={() => loadLastConversations()}>Last</Button>
            <Button sx={{ width: '150px' }} onClick={() => loadMostUpvotedConversations()} >Most Upvoted</Button>
          </ButtonGroup>
        </Box>
        <Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 6, fontWeight: 600 }}>
          {conversationsMode === "last" ? "Last" : "Most Upvoted"} Conversations
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 4,
          }}
        >
          {conversations.map((conversation, index) => (
            <Box key={index} sx={{ height: '100%', width: '100%', minWidth: 0 }}>
              <Card 
                key={conversation.id}
                elevation={2}
                sx={{
                  height: '100%',
                  width: '100%',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                  },
                }}
              >
                <CardActionArea 
                  onClick={() => handleConversationClick(conversation)}
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    height: '100%',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  {/* Top/main content grows */}
                  <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', height: '100%'}}>
                    <Box sx={{ width: '100%', minWidth: 0 }}>
                      <Typography 
                        title={conversation.topic}
                        variant="subtitle1" 
                        component="div" 
                        sx={{
                          fontWeight: 'medium',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          minWidth: 0,
                          display: 'block',
                          mr: 1
                        }}
                      >
                        {conversation.topic}
                      </Typography>
                    </Box>
                    <Divider sx={{ width: '100%', mb: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', mr: 2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%'}}>
                        {conversation.personas.map((p, i) => getPersona(p)).map((p, i) => (
                          p && <Box key={i} sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <img title={p.name} className={"avatar"} width="24" height="24" src={p.avatar_url} alt={p.name} /> 
                            &nbsp;{p.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  {/* Bottom row always sticks to bottom */}
                  <Box
                    sx={{
                      mt: 2,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <Typography variant="caption" color="textSecondary">
                      {formatDate(conversation.created_at)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center'}}>
                      <ThumbUpAlt titleAccess="Upvotes" color="primary"/>&nbsp;{conversation.upvotes || 0}
                      &nbsp;&nbsp;
                      <ThumbDownAlt titleAccess="Downvotes" color="primary"/>&nbsp;{conversation.downvotes || 0}
                    </Box>
                  </Box>
                </CardActionArea>
              </Card>
            </Box>
          ))}
        </Box>
      </Box>
      
      <Box sx={{ mb: 8 }}>
        <Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 6, fontWeight: 600 }}>
          How It Works
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 4,
          }}
        >
          {features.map((feature, index) => (
            <Box key={index}>
              <FeatureCard>
                <CardActionArea
                  sx={{
                    p: 3,
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Box
                    sx={{
                      fontSize: '3rem',
                      mb: 2,
                      transition: 'transform 0.3s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.1) rotate(5deg)',
                      },
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </FeatureCard>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ backgroundColor: 'background.paper', p: 6, borderRadius: 4, mb: 8 }}>
  <Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 4, fontWeight: 600 }}>
    Why Choose Project Palooza?
  </Typography>
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      gap: 4,
    }}
  >
    <Box>
      <Box sx={{ display: 'flex', mb: 3 }}>
        <Box sx={{ mr: 2, color: 'primary.main' }}>✨</Box>
        <Box>
          <Typography variant="h6" gutterBottom>Endless Possibilities</Typography>
          <Typography variant="body1" color="text.secondary">
            From educational content to entertainment, create conversations on any topic you can imagine.
          </Typography>
        </Box>
      </Box>
    </Box>
    <Box>
      <Box sx={{ display: 'flex', mb: 3 }}>
        <Box sx={{ mr: 2, color: 'primary.main' }}>🚀</Box>
        <Box>
          <Typography variant="h6" gutterBottom>Lightning Fast</Typography>
          <Typography variant="body1" color="text.secondary">
            Our AI processes conversations in real-time, delivering natural and engaging interactions.
          </Typography>
        </Box>
      </Box>
    </Box>
    <Box>
      <Box sx={{ display: 'flex', mb: 3 }}>
        <Box sx={{ mr: 2, color: 'primary.main' }}>🎨</Box>
        <Box>
          <Typography variant="h6" gutterBottom>Creative Freedom</Typography>
          <Typography variant="body1" color="text.secondary">
            Customize personas and conversation styles to match your creative vision.
          </Typography>
        </Box>
      </Box>
    </Box>
    <Box>
      <Box sx={{ display: 'flex', mb: 3 }}>
        <Box sx={{ mr: 2, color: 'primary.main' }}>🔒</Box>
        <Box>
          <Typography variant="h6" gutterBottom>Is it safe?</Typography>
          <Typography variant="body1" color="text.secondary">
            This project is open source and transparent. You can review the code and see how it works.
          </Typography>
        </Box>
      </Box>
    </Box>
  </Box>
  {  toastMessage && (
    <Snackbar
      open={!!toastMessage}
      autoHideDuration={6000}
      onClose={() => setToastMessage('')}
      message={toastMessage}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  )}
  </Box>
</Container>
  );
};

export default Home;
