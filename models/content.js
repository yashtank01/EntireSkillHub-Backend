const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true }, // e.g., 'video', 'article', 'blog'
    category: { type: String, required: true }, // e.g., 'Skill Building', 'Business Basics'
    bodyOrLink: { type: String, required: true }, // The YouTube link OR the article text
    authorName: { type: String, required: true }, // Who uploaded it
    createdAt: { type: Date, default: Date.now } // Automatically stamps the date
});

module.exports = mongoose.model('Content', ContentSchema);