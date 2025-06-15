import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, IconButton, Menu, MenuItem } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MenuIcon from '@mui/icons-material/Menu';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: 'linear-gradient(45deg,#f5f7fa 30%,#c3cfe2 90%)',
  boxShadow: '0 3px 5px 2px rgba(130, 152, 230, 0.3)',
  marginBottom: theme.spacing(4),
  color: 'black',
}));

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
    handleClose();
  };

  return (
    <StyledAppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontFamily: 'Arial' }}>          
          <Box component={RouterLink} to="/" sx={{ fontWeight: 'bold', textDecoration: 'none', color: '#086f95', display: 'flex', alignItems: 'center' }}>
            <img src="/assets/images/palooza.png" alt="Chat Palooza" width="40" height="40" /> &nbsp;&nbsp;Chat Palooza
          </Box>
        </Typography>

        <Button 
              color="inherit" 
              target="_blank"
              href="https://github.com/paulotaylor/chat-palooza" 
              sx={{ 
                mr: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              GitHub
            </Button>

        
        {currentUser && currentUser.isAnonymous === false ? (
          <div>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar 
                title={currentUser.email || 'User'} 
                alt={currentUser.email || 'User'} 
                src={currentUser.photoURL || undefined}
                sx={{ width: 40, height: 40 }}
              />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>Profile</MenuItem>
              <MenuItem onClick={() => { navigate('/history'); handleClose(); }}>History</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </div>
        ) : (
          <Box>
            <Button 
              color="inherit" 
              component={RouterLink} 
              to="/auth" 
              sx={{ 
                mr: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Login
            </Button>
            <Button 
              variant="outlined" 
              color="inherit" 
              component={RouterLink} 
              to="/auth?tab=signup"
              sx={{
                borderColor: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'white',
                }
              }}
            >
              Sign Up
            </Button>
          </Box>
        )}
      </Toolbar>
    </StyledAppBar>
  );
};

export default Navbar;
