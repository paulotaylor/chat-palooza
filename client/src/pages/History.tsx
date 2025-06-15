import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button,
  Typography, 
  Card, 
  CardContent, 
  CardActionArea, 
  Avatar, 
  Chip, 
  Divider, 
  IconButton, 
  TextField, 
  InputAdornment,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText
} from '@mui/material';
import { 
  Search as SearchIcon, 
  History as HistoryIcon, 
  Star as StarIcon, 
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Repeat,
  ThumbUpAlt,
  ThumbDownAlt
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PaloozaConversation, Persona } from '../types/data';
import { b } from 'framer-motion/dist/types.d-CtuPurYT';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getPersona, getPersonas } from '../services/personas';

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  isStarred: boolean;
  participants: string[];
}

const apiURL = process.env.REACT_APP_API_URL || '';


const History: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const deleteId = useRef<string | null>(null);
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<PaloozaConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const getSummary = async (conversation: PaloozaConversation) => {
    return fetch( apiURL + '/api/conversation/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personas: conversation.personas,
        topic: conversation.topic,
        transcripts: conversation.transcript,
        style: conversation.style
      })
    })  
    .then(res => res.json())
    .then(data => {
      console.log(data);
      return data?.summary || '';
    });
  }

  const sortConversations = (conversations: PaloozaConversation[]) => {
    return [...conversations].sort((a, b) => {
      if (a.isStarred !== b.isStarred) {
        return b.isStarred ? 1 : -1;
      }
      // Compare by descending creation date (assuming created_at is a Timestamp)
      const dateA = a.created_at.seconds || 0;
      const dateB = b.created_at?.seconds || 0;
      return dateB - dateA;
    });
  };

  useEffect(() => {

    getPersonas().then(personas => {
      console.log(personas);
      setPersonas(personas);
    }).catch(err => {
      console.log(err);
    });
    
    const loadConversations = async () => {

      if (!currentUser) {
        navigate('/login');
        return;
      }
      setIsLoading(true);
      // load conversations from Firebase
      const conversationsRef = collection(db, 'conversations');
      const querySnapshot = await getDocs(conversationsRef);
      const conversations: PaloozaConversation[] = querySnapshot.docs.map(doc => {
        const conversation = doc.data() as PaloozaConversation;
        return conversation;        
      });
      // order starred conversations first
      setConversations(sortConversations(conversations));
      setIsLoading(false);
    };
    loadConversations();
  }, []);

  const handleStarClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    logEvent(getAnalytics(), 'star_conversation');
    setToastMessage('Updating conversation');
    const c = conversations.find(conv => conv.id === id);
    if (!c) return;
    c.isStarred = !c.isStarred;
    updateConversation(c).then(() => {
      setToastMessage('Starred conversation');
      const newConv = conversations.map(conv => 
        conv.id === id ? { ...conv, isStarred: c.isStarred } : conv
      );
      setConversations(sortConversations(newConv));
      }).catch(error => {
        setToastMessage('Failed to update conversation');
      });
  };

  const handleConversationDelete = (id: string, e: React.MouseEvent) => {
    logEvent(getAnalytics(), 'delete_conversation');
    setIsConfirmDeleteOpen(true);
    deleteId.current = id;
    e.stopPropagation();
  };

  const handleRepeatConversation = (conversation: PaloozaConversation, e: React.MouseEvent) => {
    logEvent(getAnalytics(), 'repeat_conversation');
    e.stopPropagation();
    navigate('/', { state: {
      topic: conversation.topic,
      personas: conversation.personas,
      style: conversation.style,
    } });
  };

  const handleConfirmDeleteClose = () => {
    setIsConfirmDeleteOpen(false);
    deleteId.current = null;
  };

  const doConversationDelete = () => {
    if (!deleteId.current) return;
    setToastMessage('Deleting conversation');
    deleteConversation(deleteId.current).then(() => {
      setToastMessage('Deleted conversation');
      setConversations(conversations.filter(conv => conv.id !== deleteId.current));
      setIsConfirmDeleteOpen(false);
      deleteId.current = null;
    }).catch(error => {
      setToastMessage('Failed to delete conversation');
      setIsConfirmDeleteOpen(false);
      deleteId.current = null;
    });
  };

  const handleConversationClick = (conversation: PaloozaConversation) => {
    console.log('Opening conversation', conversation);
    logEvent(getAnalytics(), 'open_conversation_history');
    navigate(`/conversation/${conversation.id}` , { state: {
      topic: conversation.topic,
      personas: conversation.personas.map(p => getPersona(p)),
      style: conversation.style,
      transcript: conversation.transcript,
      isLive: false,
      url: conversation.audio_url,
      conversation: conversation
    } });
  };

  const conversationTranscript = (conv: PaloozaConversation) => {
    const transcript = conv.transcript.map(entry => entry.text);
    const preview = transcript.slice(0, 100).join('\n');
    return preview;
  };

  const filteredConversations = conversations.filter(conv => 
    conv.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversationTranscript(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography variant="body2" color="textSecondary" sx={{ margin: 2 }}>
          Loading conversations...
        </Typography>
      </Box>
    );
  }

  function handleGenerateSummaryClick(conversation: PaloozaConversation, e: React.MouseEvent): void {
    e.stopPropagation();
    logEvent(getAnalytics(), 'generate_summary');
    setIsGeneratingSummary(true);
    setToastMessage('Generating summary...');
    getSummary(conversation).then(summary => {
      setIsGeneratingSummary(false);
      if (!summary) {
        setToastMessage('Failed to generate summary');
        return;
      }
      conversation.summary = summary;
      console.log(summary);
      updateConversation(conversation).then(() => {
        setToastMessage('Summary updated');
        setConversations(conversations.map(c => c.id === conversation.id ? conversation : c));
      }).catch(error => {
        setToastMessage('Failed to update conversation');
      });
    });
  }

  /**
   * Updates a conversation in Firebase
   * @param conversation the conversation to update
   */
  function updateConversation(conversation: PaloozaConversation): Promise<void> {
    const conversationRef = doc(db, 'conversations', conversation.id);
    return setDoc(conversationRef, conversation).then(() => {
      console.log('Conversation updated to Firebase');
    }).catch(error => {
      console.error('Update conversation failed:', error);
    });
  }

  /**
   * Deletes a conversation from Firebase
   * @param conversationId the ID of the conversation to delete
   */
  async function deleteConversation(conversationId: string): Promise<void> {
    const conversationRef = doc(db, 'conversations', conversationId);
    try {
      await deleteDoc(conversationRef);
      console.log('Conversation deleted from Firebase');
    } catch (error) {
      console.error('Delete conversation failed:', error);
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: '2rem' }} />
          Conversation History
        </Typography>
        
        <TextField
          variant="outlined"
          placeholder="Search conversations..."
          size="small"
          value={searchQuery}
          disabled={isLoading || conversations.length === 0}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            sx: { borderRadius: 8, backgroundColor: 'background.paper' }
          }}
          sx={{ width: isMobile ? '100%' : 300, mt: isMobile ? 2 : 0 }}
        />
      </Box>

      <Divider sx={{ mb: 3 }} />

      {filteredConversations.length === 0 ? (
        <Box textAlign="center" py={8}>
          <HistoryIcon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="textSecondary">
            {searchQuery ? 'No matching conversations found' : 'No conversation history yet'}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {searchQuery ? 'Try a different search term' : 'Start a new conversation to see it here'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => navigate('/')}
            sx={{ minWidth: 180, margin: 2 }}
          >
            Start Conversation
          </Button>

        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {filteredConversations.map((conversation) => (
            <Card 
              key={conversation.id}
              elevation={2}
              sx={{
                borderRadius: 2,
                transition: 'all 0.2s',
                borderLeft: `4px solid ${conversation.isStarred ? theme.palette.secondary.main : 'transparent'}`,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              <CardActionArea 
                onClick={() => handleConversationClick(conversation)}
                sx={{ p: 2 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography 
                        variant="subtitle1" 
                        component="div" 
                        sx={{ 
                          fontWeight: 'medium',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          mr: 1
                        }}
                      >
                        {conversation.topic}
                      </Typography>
                      <Box sx={{ display: 'flex', ml: 'auto' }}>
                        <IconButton 
                          size="small" 
                          title="Add to favorites"
                          onClick={(e) => handleStarClick(conversation.id, e)}
                          color={conversation.isStarred ? 'secondary' : 'default'}
                        >
                          {conversation.isStarred ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                        <IconButton 
                          size="small" 
                          title="Reuse Conversation"
                          onClick={(e) => handleRepeatConversation(conversation, e)}
                          color="default"
                        >
                          <Repeat fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          title="Delete Conversation"
                          onClick={(e) => handleConversationDelete(conversation.id, e)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography 
                      variant="body2" 
                      color="textSecondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conversation.summary || 'No summary available'}
                    </Typography>
                    { !conversation.summary && conversation.transcript.length > 0 && (
                      <Button
                        disabled={isGeneratingSummary}
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={(e) => handleGenerateSummaryClick(conversation, e)}
                        sx={{
                          ml: 1,
                          textTransform: 'none'
                        }}
                      >
                        Generate Summary
                      </Button>
                    )}
                    </Box>

                  <Divider sx={{ width: '100%', mb: 2 }} />
                      
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', mr: 2 }}>
                        {conversation.personas.map(id => getPersona(id)).map((p, i) => (
                          p && <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                          <img className={"avatar"} width="24" height="24" src={p.avatar_url} alt={p.name} /> 
                            &nbsp;{p.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                          {formatDate(conversation.created_at)}
                      </Typography>
                      <Box sx={{ display: 'flex', ml: 'auto', alignItems: 'center'}}>
                        <ThumbUpAlt color="primary"/>&nbsp;{conversation.upvotes || 0}
                        &nbsp;&nbsp;
                        <ThumbDownAlt color="primary"/>&nbsp;{conversation.downvotes || 0}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
      {toastMessage && <Snackbar
        open={true}
        autoHideDuration={3000}
        message={ toastMessage }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setToastMessage('')}
      />}
      <Dialog
        open={isConfirmDeleteOpen}
        onClose={handleConfirmDeleteClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Delete Conversation?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDeleteClose}>Cancel</Button>
          <Button onClick={doConversationDelete} autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default History;
