import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Button,
  TextField,
  Divider,
  Paper,
  IconButton,
  CircularProgress,
  useTheme,
  useMediaQuery,
  InputAdornment
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Profile: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
      setEmail(currentUser.email || '');
      setBio('AI enthusiast and conversation explorer');
    }
  }, [currentUser]);

  const handleSave = () => {
    // In a real app, you would update the user's profile via API here
    setIsEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (!currentUser) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography variant="h6">Please sign in to view your profile</Typography>
        <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={() => navigate('/auth')}>
          Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', p: isMobile ? 2 : 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Avatar src={photoURL} sx={{ width: 100, height: 100, mb: 2 }}>
            {!photoURL && <PersonIcon sx={{ fontSize: 48 }} />}
          </Avatar>
          {isEditing ? (
            <TextField
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                ),
              }}
            />
          ) : (
            <Typography variant="h5" fontWeight="bold">{displayName}</Typography>
          )}
          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>{email}</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        {isEditing ? (
          <TextField
            label="Bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
        ) : (
          <Typography variant="body1" sx={{ mb: 2 }}>
            {bio}
          </Typography>
        )}
        <Box display="flex" justifyContent="space-between" mt={4}>
          <Button
            variant={isEditing ? 'contained' : 'outlined'}
            color="primary"
            startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
            onClick={isEditing ? handleSave : () => setIsEditing(true)}
            disabled={isLoading}
          >
            {isEditing ? (isLoading ? <CircularProgress size={20} /> : 'Save') : 'Edit Profile'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Profile;
