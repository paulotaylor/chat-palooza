import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Divider, 
  Link, 
  Alert, 
  IconButton, 
  InputAdornment,
  CircularProgress,
  styled
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Google as GoogleIcon,
  Facebook as FacebookIcon,
  Email as EmailIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const AuthPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 500,
  margin: '0 auto',
  borderRadius: Number(theme.shape.borderRadius) * 2,
  boxShadow: theme.shadows[3],
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 2),
  },
}));

const SocialButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  padding: '10px 16px',
  borderRadius: Number(theme.shape.borderRadius) * 2,
  fontWeight: 500,
  marginBottom: theme.spacing(2),
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
  },
}));

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  
  const { login, signup, signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');

  useEffect(() => {
    if (tab === 'signup') {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [tab]);

  useEffect(() => {
    if (currentUser && currentUser.isAnonymous === false) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setLoading(true);
      if (isLogin) {
        await login(email, password);
        setSuccess('Successfully logged in!');
      } else {
        await signup(email, password);
        setSuccess('Account created successfully! Please check your email to verify your account.');
        // Reset form after successful signup
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      setSuccess('Successfully logged in with Google!');
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
  };

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
      <AuthPaper elevation={3}>
        <Typography component="h1" variant="h4" align="center" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
          {isLogin ? 'Welcome Back!' : 'Create an Account'}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <SocialButton
          fullWidth
          variant="outlined"
          onClick={handleGoogleSignIn}
          disabled={loading}
          startIcon={<GoogleIcon />}
          sx={{
            borderColor: '#DB4437',
            color: '#DB4437',
            '&:hover': {
              backgroundColor: 'rgba(219, 68, 55, 0.04)',
              borderColor: '#DB4437',
            },
          }}
        >
          Continue with Google
        </SocialButton>

        <SocialButton
          fullWidth
          variant="outlined"
          disabled={true}
          startIcon={<FacebookIcon />}
          sx={{
            borderColor: '#4267B2',
            color: '#4267B2',
            mb: 4,
            '&:hover': {
              backgroundColor: 'rgba(66, 103, 178, 0.04)',
              borderColor: '#4267B2',
            },
          }}
        >
          Continue with Facebook
        </SocialButton>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Divider sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
            OR
          </Typography>
          <Divider sx={{ flexGrow: 1 }} />
        </Box>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {!isLogin && (
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {isLogin && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">
                Forgot password?
              </Link>
            </Box>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              mt: 2,
              mb: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #6200ee 30%, #03dac6 90%)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(98, 0, 238, 0.3)',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Sign Up'
            )}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <Link
                component={RouterLink}
                to={isLogin ? '/auth?tab=signup' : '/auth'}
                onClick={(e) => {
                  e.preventDefault();
                  toggleAuthMode();
                }}
                sx={{
                  color: 'primary.main',
                  fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </Link>
            </Typography>
          </Box>
        </Box>
      </AuthPaper>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          By continuing, you agree to our{' '}
          <Link href="/terms" color="primary">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" color="primary">
            Privacy Policy
          </Link>
          .
        </Typography>
      </Box>
    </Container>
  );
};

export default Auth;
