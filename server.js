// 1. Imports
const express = require('express');
const bcrypt = require('bcryptjs');
const SavedIdea = require('./models/SavedIdea');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const MentorRequest = require('./models/MentorRequest');
require('dotenv').config();

// 2. Initialize App
const app = express();

// 3. Middleware
app.use(cors());           // Allows frontend to talk to backend
app.use(express.json());   // Tells server how to read incoming JSON data
app.use(express.urlencoded({ extended: true }));

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.log('❌ MongoDB connection error:', err));

// 5. API Routes

// Test Route
app.get('/', (req, res) => {
    res.send('Welcome to the EntreSkill Hub Backend API!');
});

// --- Route 1: Register a New User ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password,role } = req.body;
        
        // 1. Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use!" });
        }

        // 2. Scramble (Hash) the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Save the new user with the scrambled password
        const newUser = new User({ name, email, password: hashedPassword ,role:role ||'student'});
        await newUser.save();

        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Server error during registration" });
    }
});

// --- Route 2: Login User ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find the user by their email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "User not found!" });
        }

        // 2. Check if the password matches the scrambled one in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect password!" });
        }

        res.status(200).json({ message: "Login successful!" ,
            name: user.name, 
            role: user.role
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login" });
    }
});

// --- Route 3: Google Login Callback (UPDATED & FIXED) ---
app.post('/api/auth/google', async (req, res) => {
    try {
        const secureToken = req.body.credential;
        
        // If no token is found, send them safely back to the login page
        if (!secureToken) {
            return res.redirect('https://entre-skill-hub.netlify.app/auth.html'); 
        }
        
        // 1. Crack open the middle part of the Google Token using Node's Buffer
        const payloadData = JSON.parse(Buffer.from(secureToken.split('.')[1], 'base64').toString());
        
        // 2. Extract the user's name and email!
        const userName = payloadData.name;
        const userEmail = payloadData.email;
        console.log(`✅ Google Login caught for: ${userName} (${userEmail})`);

        // Check MongoDB for roles
        const existingUser = await User.findOne({ email: userEmail });
        
        if (existingUser && existingUser.role === 'admin') {
           return res.redirect(`https://entre-skill-hub.netlify.app/admin-dashboard.html?name=${encodeURIComponent(userName)}&role=admin`);
        } else if (existingUser && existingUser.role === 'mentor') {
            return res.redirect(`https://entre-skill-hub.netlify.app/mentor-dashboard.html?name=${encodeURIComponent(userName)}`);
        } else {
            // Default student route
            return res.redirect(`https://entre-skill-hub.netlify.app/dashboard.html?name=${encodeURIComponent(userName)}`);
        }
        
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.redirect('https://entre-skill-hub.netlify.app/auth.html');
    }
});

// --- SAFETY NET: Handle accidental GET requests for Google Auth ---
// If a user refreshes the page or clicks a manual link while Render wakes up, bounce them back to login instead of crashing
app.get('/api/auth/google', (req, res) => {
    console.log('⚠️ Caught accidental GET request to Google Auth route. Redirecting to login.');
    res.redirect('https://entre-skill-hub.netlify.app/auth.html'); 
});

// --- Route: Save Business Idea ---
app.post('/api/save-idea', async (req, res) => {
    try {
        const { idea } = req.body;
        console.log(`📌 Received request to save idea: ${idea}`);
        
        // 1. Create a new record using the blueprint
        const newIdea = new SavedIdea({
            ideaName: idea
        });

        // 2. Save it to MongoDB
        await newIdea.save();

        // 3. Send success back to the frontend
        res.status(200).json({ message: "Idea saved securely to the database!" });
    } catch (error) {
        console.error("Error saving idea:", error);
        res.status(500).json({ error: "Failed to save idea" });
    }
});

// --- Route: Request Mentor ---
app.post('/api/request-mentor', async (req, res) => {
    try {
        const { mentor } = req.body;
        console.log(`✉️ Received request for mentor: ${mentor}`);
        
        // 1. Create a new record using the blueprint
        const newRequest = new MentorRequest({
            mentorName: mentor
        });

        // 2. Save it to MongoDB
        await newRequest.save();

        // 3. Send success back to the frontend
        res.status(200).json({ message: "Mentor requested and saved successfully!" });
    } catch (error) {
        console.error("Error saving mentor request:", error);
        res.status(500).json({ error: "Failed to request mentor" });
    }
});

// --- Route: Mentor Accepts/Declines a Student ---
app.post('/api/manage-request', async (req, res) => {
    try {
        const { action, studentName } = req.body;
        console.log(`✅ Mentor marked request from ${studentName} as: ${action}`);
        
        res.status(200).json({ message: "Student request updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update request" });
    }
});

// --- Route: Mentor Uploads a Resource ---
app.post('/api/upload-resource', async (req, res) => {
    try {
        const { title, category, url } = req.body;
        console.log(`📥 New Resource Uploaded: [${category}] ${title} - ${url}`);
        
        res.status(200).json({ message: "Resource successfully published to students!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to upload resource" });
    }
});

// --- Route: Get All Saved Ideas ---
app.get('/api/saved-ideas', async (req, res) => {
    try {
        const ideas = await SavedIdea.find().sort({ savedAt: -1 }); // Fetches newest first
        res.status(200).json(ideas);
    } catch (error) {
        console.error("Error fetching ideas:", error);
        res.status(500).json({ error: "Failed to fetch saved ideas" });
    }
});

// --- Route: Get All Mentor Requests ---
app.get('/api/mentor-requests', async (req, res) => {
    try {
        const requests = await MentorRequest.find().sort({ requestDate: -1 }); // Fetches newest first
        res.status(200).json(requests);
    } catch (error) {
        console.error("Error fetching mentors:", error);
        res.status(500).json({ error: "Failed to fetch mentor requests" });
    }
});

// 6. Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running successfully on port ${PORT}`);
});