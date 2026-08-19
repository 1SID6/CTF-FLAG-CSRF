const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const uuidv4 = crypto.randomUUID.bind(crypto);
const path = require('path');
const { visitUrl } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// In-memory Database
const users = {
    'admin': { password: 'password', flags: { level1: true, level2: true, level3: true } },
    'student': { password: 'student', flags: { level1: false, level2: false, level3: false } }
};

const sessions = {}; // sessionId -> username
const csrfTokens = {}; // sessionId -> csrfToken

// Middleware to populate req.user
app.use((req, res, next) => {
    const sessionId = req.cookies.session_id;
    if (sessionId && sessions[sessionId]) {
        req.user = { username: sessions[sessionId], ...users[sessions[sessionId]] };
    }
    next();
});

// Require Login Middleware
const requireLogin = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    next();
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        const sessionId = uuidv4();
        sessions[sessionId] = username;
        // Set cookie (no SameSite attribute to allow standard CSRF in all browsers for the CTF)
        res.cookie('session_id', sessionId, { httpOnly: true });
        return res.redirect('/');
    }
    res.render('login', { error: 'Invalid credentials' });
});

app.get('/logout', (req, res) => {
    res.clearCookie('session_id');
    res.redirect('/');
});

// LEVEL 1: No Protection
app.get('/level1', requireLogin, (req, res) => {
    res.render('level', { 
        level: 1, 
        title: 'Level 1: Basic CSRF', 
        description: 'No CSRF protection at all. The endpoint accepts a POST request to transfer the flag.',
        user: req.user,
        message: req.query.message
    });
});

app.post('/level1/transfer', requireLogin, (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).send('Nice try, but you are not the admin! You must trick the admin (bot) into making this request.');
    }
    const { target_user } = req.body;
    if (users[target_user]) {
        users[target_user].flags.level1 = true;
        return res.redirect('/level1?message=Flag+transferred+successfully');
    }
    res.redirect('/level1?message=User+not+found');
});

// LEVEL 2: Strict Referer Check (allows empty)
app.get('/level2', requireLogin, (req, res) => {
    res.render('level', { 
        level: 2, 
        title: 'Level 2: Weak Referer Validation', 
        description: 'The server checks the Referer header, but it allows requests with no Referer header.',
        user: req.user,
        message: req.query.message
    });
});

app.post('/level2/transfer', requireLogin, (req, res) => {
    const referer = req.headers.referer;
    
    // Protection logic
    if (referer !== undefined) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.host !== req.headers.host) {
                return res.status(403).send('Invalid Referer');
            }
        } catch (e) {
            return res.status(403).send('Invalid Referer');
        }
    }

    if (req.user.username !== 'admin') {
        return res.status(403).send('Nice try, but you are not the admin! You must trick the admin (bot) into making this request.');
    }

    const { target_user } = req.body;
    if (users[target_user]) {
        users[target_user].flags.level2 = true;
        return res.redirect('/level2?message=Flag+transferred+successfully');
    }
    res.redirect('/level2?message=User+not+found');
});

// LEVEL 3: Method Override / Flawed Token Logic
app.get('/level3', requireLogin, (req, res) => {
    const sessionId = req.cookies.session_id;
    if (!csrfTokens[sessionId]) {
        csrfTokens[sessionId] = uuidv4();
    }
    
    res.render('level3', { 
        level: 3, 
        title: 'Level 3: Flawed CSRF Token', 
        description: 'The endpoint requires a valid CSRF token, but the validation is flawed based on HTTP method.',
        user: req.user,
        csrfToken: csrfTokens[sessionId],
        message: req.query.message
    });
});

app.all('/level3/transfer', requireLogin, (req, res) => {
    // Only check CSRF token on POST requests
    if (req.method === 'POST') {
        const sessionId = req.cookies.session_id;
        const submittedToken = req.body.csrf_token;
        if (!submittedToken || submittedToken !== csrfTokens[sessionId]) {
            return res.status(403).send('Invalid CSRF Token');
        }
    }

    if (req.user.username !== 'admin') {
        return res.status(403).send('Nice try, but you are not the admin! You must trick the admin (bot) into making this request.');
    }

    // Accept target_user from either body or query (so GET bypass works)
    const target_user = req.body.target_user || req.query.target_user;
    
    if (users[target_user]) {
        users[target_user].flags.level3 = true;
        return res.redirect('/level3?message=Flag+transferred+successfully');
    }
    res.redirect('/level3?message=User+not+found');
});

// BOT
app.get('/bot', (req, res) => {
    res.render('bot', { message: null, user: req.user });
});

app.post('/bot/visit', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
        return res.render('bot', { message: 'Invalid URL. Must start with http or https.', user: req.user });
    }

    try {
        await visitUrl(url);
        res.render('bot', { message: 'Bot successfully visited the URL.', user: req.user });
    } catch (err) {
        res.render('bot', { message: `Bot encountered an error: ${err.message}`, user: req.user });
    }
});

app.listen(PORT, () => {
    console.log(`CSRF CTF App running at http://localhost:${PORT}`);
});
