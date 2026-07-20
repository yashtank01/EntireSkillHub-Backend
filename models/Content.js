const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    url: { type: String, required: true },           // Pehle ye 'bodyOrLink' tha
    uploadedBy: { type: String, required: true },    // Pehle ye 'authorName' tha
    isApproved: { type: Boolean, default: false },   // Admin verification ke liye!
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', contentSchema);