// ==========================================
// 1. Imports & Setup
// ==========================================
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Models
const User = require('./models/User');
const SavedIdea = require('./models/SavedIdea');
const MentorRequest = require('./models/MentorRequest');
const Content = require('./models/Content');

// 2. Initialize App
const app = express();

// 3. Middleware
app.use(cors());           
app.use(express.json());   
app.use(express.urlencoded({ extended: true }));

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.log('❌ MongoDB connection error:', err));

// ==========================================
// 5. API ROUTES
// ==========================================

// Test Route
app.get('/', (req, res) => {
    res.send('Welcome to the EntreSkill Hub Backend API!');
});

// --- AUTHENTICATION ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already in use!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword, role: role || 'student' });
        await newUser.save();

        if (role === 'mentor') {
            res.status(201).json({ message: "Registration successful! You will be able to login once the Admin approves your account." });
        } else {
            res.status(201).json({ message: "Registration successful!" });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error during registration" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password!" });

        if (user.role === 'mentor' && user.isMentorApproved === false) {
            return res.status(403).json({ error: "Your profile is under review! You can login once Admin approves it." });
        }

        res.status(200).json({ 
            message: "Login successful!",
            name: user.name, 
            role: user.role,
            isMentorApproved: user.isMentorApproved
        });
    } catch (error) {
        res.status(500).json({ error: "Server error during login" });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const secureToken = req.body.credential;
        if (!secureToken) return res.redirect('https://entre-skill-hub.netlify.app/auth.html'); 
        
        const payloadData = JSON.parse(Buffer.from(secureToken.split('.')[1], 'base64').toString());
        const userName = payloadData.name;
        const userEmail = payloadData.email;
        console.log(`✅ Google Login caught for: ${userName} (${userEmail})`);

        const existingUser = await User.findOne({ email: userEmail });
        
        if (existingUser && existingUser.role === 'admin') {
           return res.redirect(`https://entre-skill-hub.netlify.app/admin-dashboard.html?name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}&role=admin`);
        } else if (existingUser && existingUser.role === 'mentor') {
            return res.redirect(`https://entre-skill-hub.netlify.app/mentor-dashboard.html?name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}`);
        } else {
            return res.redirect(`https://entre-skill-hub.netlify.app/dashboard.html?name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}`);
        }
    } catch (error) {
        res.redirect('https://entre-skill-hub.netlify.app/auth.html');
    }
});

app.get('/api/auth/google', (req, res) => {
    res.redirect('https://entre-skill-hub.netlify.app/auth.html'); 
});


// --- STUDENT DASHBOARD ROUTES ---
app.post('/api/save-idea', async (req, res) => {
    try {
        const { idea, email } = req.body;
        console.log(`📌 Idea Bookmarked: ${idea} by ${email}`);

        if (!email) return res.status(400).json({ error: "User email is required." });

        const existingIdea = await SavedIdea.findOne({ ideaName: idea, userEmail: email });
        if (existingIdea) return res.status(400).json({ error: "Already bookmarked!" });

        const newIdea = new SavedIdea({ ideaName: idea, userEmail: email });
        await newIdea.save();
        res.status(200).json({ message: "Idea saved successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save idea." });
    }
});

app.get('/api/saved-ideas', async (req, res) => {
    try {
        const userEmail = req.query.email;
        if (!userEmail) return res.status(400).json({ error: "Email is required." });

        const userIdeas = await SavedIdea.find({ userEmail: userEmail }).sort({ createdAt: -1 });
        res.status(200).json(userIdeas);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch saved ideas." });
    }
});

app.get('/api/content', async (req, res) => {
    try {
        const allContent = await Content.find({ isApproved: true }).sort({ createdAt: -1 });
        res.status(200).json(allContent);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch training content." });
    }
});

// --- MENTOR ROUTES ---
app.post('/api/request-mentor', async (req, res) => {
    try {
        const { mentor, email } = req.body;
        console.log(`✉️ Mentor Requested: ${mentor} by ${email}`);

        const existing = await MentorRequest.findOne({ mentorName: mentor, userEmail: email });
        if (existing) return res.status(400).json({ error: "Already requested!" });

        const newRequest = new MentorRequest({ mentorName: mentor, userEmail: email, status: 'Pending' });
        await newRequest.save();
        res.status(200).json({ message: "Mentor requested successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to request mentor" });
    }
});

app.get('/api/mentor-requests', async (req, res) => {
    try {
        const userEmail = req.query.email;
        const requests = await MentorRequest.find({ userEmail: userEmail }).sort({ requestDate: -1 });
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch mentor requests" });
    }
});

app.post('/api/manage-request', async (req, res) => {
    try {
        const { action, studentName, mentorEmail } = req.body;
        res.status(200).json({ message: "Student request updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update request" });
    }
});

// --- ADMIN ROUTES ---
app.get('/api/admin-stats', async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const activeMentors = await User.countDocuments({ role: 'mentor', isMentorApproved: true });
        const bookmarkedIdeas = await SavedIdea.countDocuments();
        const pendingContent = await Content.countDocuments({ isApproved: false }) || 0; 
        res.status(200).json({ totalStudents, activeMentors, bookmarkedIdeas, pendingContent });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.get('/api/pending-mentors', async (req, res) => {
    try {
        const pendingMentors = await User.find({ role: 'mentor', isMentorApproved: false });
        res.status(200).json(pendingMentors);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending mentors" });
    }
});

app.post('/api/approve-mentor', async (req, res) => {
    try {
        const { mentorId } = req.body;
        await User.findByIdAndUpdate(mentorId, { isMentorApproved: true });
        res.status(200).json({ message: "Mentor approved successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to approve mentor" });
    }
});

app.post('/api/upload-content', async (req, res) => {
    try {
        const { title, category, url, type, uploadedBy } = req.body;
        console.log(`📤 New Content Upload Attempt: [${type}] ${title} by ${uploadedBy}`);

        const newContent = new Content({ title, category, url, type, uploadedBy, isApproved: false });
        await newContent.save();
        
        console.log("✅ Content Saved Successfully!");
        res.status(201).json({ message: "Uploaded to DB, waiting for admin approval!" });
    } catch (error) {
        console.error("❌ Content Upload Error:", error);
        res.status(500).json({ error: "Failed to upload content." });
    }
});

app.get('/api/pending-content', async (req, res) => {
    try {
        const pending = await Content.find({ isApproved: false });
        res.status(200).json(pending);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending content" });
    }
});

app.post('/api/approve-content', async (req, res) => {
    try {
        const { contentId } = req.body;
        await Content.findByIdAndUpdate(contentId, { isApproved: true });
        res.status(200).json({ message: "Content Approved!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to approve content" });
    }
});

app.delete('/api/content/:id', async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Content Deleted!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete content" });
    }
});

// ==========================================
// 6. Start the Server
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running successfully on port ${PORT}`);
});