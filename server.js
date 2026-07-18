// 1. Imports
const express = require('express');
const bcrypt = require('bcryptjs');
const SavedIdea = require('./models/SavedIdea');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const MentorRequest = require('./models/MentorRequest');
require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Built into Node.js, no need to install!
const Content = require('./models/Content');
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
            role: user.role,
            isMentorApproved: user.isMentorApproved
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
// --- Route: Get Pending Mentors (For Admin Dashboard) ---
app.get('/api/pending-mentors', async (req, res) => {
    try {
        // Find everyone whose role is 'mentor' but is NOT approved yet
        const pendingMentors = await User.find({ role: 'mentor', isMentorApproved: false });
        res.status(200).json(pendingMentors);
    } catch (error) {
        console.error("Error fetching pending mentors:", error);
        res.status(500).json({ error: "Failed to fetch pending mentors" });
    }
});

// --- Route: Approve a Mentor (For Admin Dashboard) ---
app.post('/api/approve-mentor', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`✅ Admin is approving mentor: ${email}`);
        
        // Find the user by their email and flip their switch to true!
        await User.findOneAndUpdate({ email: email }, { isMentorApproved: true });
        
        res.status(200).json({ message: "Mentor approved successfully!" });
    } catch (error) {
        console.error("Error approving mentor:", error);
        res.status(500).json({ error: "Failed to approve mentor" });
    }
});
// --- Route: Forgot Password ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: "No account found with that email!" });
        }

        // 1. Generate a random, secure token
        const resetToken = crypto.randomBytes(20).toString('hex');
        
        // 2. Save the token and an expiration time (15 mins) to the user's database record
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
        await user.save();

        // 3. Set up Nodemailer to log into your Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 4. Draft the email!
        const resetLink = `https://entre-skill-hub.netlify.app/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'EntreSkill Hub - Password Reset',
            text: `Hello ${user.name},\n\nYou requested a password reset. Click this secure link to reset your password:\n\n${resetLink}\n\nThis link will expire in 15 minutes.\nIf you did not request this, please ignore this email.`
        };

        // 5. Send it
        await transporter.sendMail(mailOptions);
        console.log(`✉️ Password reset email sent to: ${user.email}`);
        
        res.status(200).json({ message: "Password reset link sent to your email!" });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to send email." });
    }
});

// --- Route: Upload New Content (For Admin & Mentor Dashboards) ---
app.post('/api/upload-content', async (req, res) => {
    try {
        const { title, type, category, bodyOrLink, authorName } = req.body;
        
        // Create the new piece of content using the data sent from the frontend
        const newContent = new Content({
            title,
            type,
            category,
            bodyOrLink,
            authorName
        });

        // Save it to MongoDB
        await newContent.save();
        console.log(`📚 New ${type} uploaded by ${authorName}: ${title}`);
        
        res.status(201).json({ message: "Content uploaded successfully!" });
    } catch (error) {
        console.error("Error uploading content:", error);
        res.status(500).json({ error: "Failed to upload content to the database." });
    }
});
// --- Route: Get All Content (For Student Dashboard) ---
app.get('/api/content', async (req, res) => {
    try {
        // Find all content and sort by newest first (-1)
        const allContent = await Content.find().sort({ createdAt: -1 });
        res.status(200).json(allContent);
    } catch (error) {
        console.error("Error fetching content:", error);
        res.status(500).json({ error: "Failed to fetch training content." });
    }
});

// ==========================================
// ROUTE: Save a Business Idea (With Duplicate Check!)
// ==========================================
app.post('/api/save-idea', async (req, res) => {
    try {
        const { idea, email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "User email is required to save an idea." });
        }

        // 🛑 DUPLICATE CHECK: Does this user already have this exact idea saved?
        const existingIdea = await SavedIdea.findOne({ ideaName: idea, userEmail: email });
        if (existingIdea) {
            return res.status(400).json({ error: "You have already bookmarked this idea!" });
        }

        // If it's new, save it!
        const newIdea = new SavedIdea({ 
            ideaName: idea,
            userEmail: email 
        });
        
        await newIdea.save();
        res.status(200).json({ message: "Idea saved successfully!" });

    } catch (error) {
        console.error("Error saving idea:", error);
        res.status(500).json({ error: "Failed to save idea." });
    }
});

// ==========================================
// ROUTE: Get Bookmarked Ideas for a SPECIFIC User
// ==========================================
app.get('/api/saved-ideas', async (req, res) => {
    try {
        const userEmail = req.query.email; // We grab the email from the URL

        if (!userEmail) {
            return res.status(400).json({ error: "Email is required to fetch saved ideas." });
        }

        // ONLY find ideas that belong to this specific email!
        const userIdeas = await SavedIdea.find({ userEmail: userEmail }).sort({ createdAt: -1 });
        
        res.status(200).json(userIdeas);
    } catch (error) {
        console.error("Error fetching saved ideas:", error);
        res.status(500).json({ error: "Failed to fetch saved ideas." });
    }
});
// 6. Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running successfully on port ${PORT}`);
});