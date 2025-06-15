# ChatPalooza

## Client

The client is a React.js application that users WebSockets to connect to the server and provide a user interface for real-time AI conversations.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

## Environment variables

sample .env:

```
REACT_APP_FIREBASE_API_KEY=AIxxxZZ
REACT_APP_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=xxx
REACT_APP_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
REACT_APP_FIREBASE_APP_ID=1:1234567890:web:abcd1234567890
REACT_APP_FIREBASE_MEASUREMENT_ID=G-xxxxxx
REACT_APP_WEBSOCKET_URL=ws://localhost:5001
REACT_APP_GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
```