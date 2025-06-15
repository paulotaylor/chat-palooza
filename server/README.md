# ChatPalooza

## Introduction

The server is a Node.js application that provides a WebSocket API for real-time AI conversations as well as endoints to fetch personas, conversation styles and popular topics.


## Available Scripts

In the project directory, you can run:

### `npm dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Environemnt Variables

### Topics

Popular topics are defined in the .env file as a JSON array.

```
TOPICS=["Topic 1", "Topic 2", "Topic 3"]
```

### Personas

Set the environment variable PERSONAS to the path of the personas.json file.

```
PERSONAS=personas.json
```

Personas are defined in the personas.json file.

```json
[
    { 
      "id": "yoda", 
      "name": "Yoda, The Jedi Master", 
      "description": "Ancient Jedi Master speaking in inverted wisdom", 
      "category": "legendary", 
      "avatar_url": "/assets/avatars/yoda.png", 
      "voice": "male", 
      "speech": "Yoda speaks with inverted syntax and Force wisdom, saying things like 'Strong with the Force, you are' or 'Do or do not, there is no try.' His unique speech pattern reflects 900 years of wisdom and deep connection to the Force.",
      "personality_traits": ["wise", "patient", "powerful", "humble"],
      "speaking_style": "inverted syntax with Force wisdom and patient teaching",
      "conversation_strengths": ["spiritual wisdom", "patient teaching", "inner strength guidance"]
    }
    ...
]
```

### Conversation styles

Set the environment variable STYLES to the path of the styles.json file.


```
STYLES=styles.json
```

Conversation styles are defined in the styles.json file.

```json
[
    { 
        "id": "casual", 
        "name": "Casual Chat", 
        "description": "A friendly, informal conversation" 
    }, 
    { 
        "id": "podcast", 
        "name": "Podcast", 
        "description": "A longer-form discussion with multiple topics and perspectives"
    }, 
      ...
]
```

### Example .env file


```
FIREBASE_API_KEY=AIxxxxxM
FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
FIREBASE_PROJECT_ID=xxxxx
FIREBASE_STORAGE_BUCKET=xxxxx.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=xxxxx
FIREBASE_APP_ID=1:xxxxx:web:xxxxx
FIREBASE_MEASUREMENT_ID=G-xxxxx
GOOGLE_AI_API_KEY=AIxxxxxw

TOPICS=["Topic 1", "Topic 2", "Topic 3"]
PERSONAS=personas.json
STYLES=styles.json

```