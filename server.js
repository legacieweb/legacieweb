const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const session = require('express-session');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;

// JWT Secret Key
const JWT_SECRET = 'mySuperSecretJWTKey123!';  // Added here, replace with a strong secret key

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configure session middleware
app.use(session({
    secret: JWT_SECRET,  // Use the JWT secret key here as the session secret
    resave: false,              // Prevents session from being saved back to the store if it wasn't modified
    saveUninitialized: true,    // Forces a session to be saved when it's new but not modified
    cookie: { secure: false }   // Set to true if you're using HTTPS
}));
// ✅ Import Routes

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/themes', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Schemas
const CategorySchema = new mongoose.Schema({
    name: String,
});

const ThemeSchema = new mongoose.Schema({
    category: String,
    name: String,
    price: String,
    image: String,
    pages: [
        {
            name: String,
            html: String,
        },
    ],
});

const Category = mongoose.model('Category', CategorySchema);
const Theme = mongoose.model('Theme', ThemeSchema);


// ---- ROUTES ----

// 1. Create a New Category
app.post('/api/category', async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).send(category);
    } catch (err) {
        res.status(500).send({ error: 'Failed to create category', details: err.message });
    }
});

// 2. Get All Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find();
        res.send(categories);
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch categories', details: err.message });
    }
});

// 3. Create a New Theme
app.post('/api/theme', async (req, res) => {
    try {
        const theme = new Theme(req.body);
        await theme.save();
        res.status(201).send(theme);
    } catch (err) {
        res.status(500).send({ error: 'Failed to create theme', details: err.message });
    }
});

// 4. Get Themes by Category
app.get('/api/themes/:category', async (req, res) => {
    try {
        const themes = await Theme.find({ category: req.params.category });
        res.send(themes);
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch themes', details: err.message });
    }
});

// 5. Get a Single Theme by ID
app.get('/api/theme/:id', async (req, res) => {
    try {
        const theme = await Theme.findById(req.params.id);
        if (!theme) {
            return res.status(404).send({ error: 'Theme not found' });
        }
        res.send(theme);
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch theme', details: err.message });
    }
});

// 6. Add a New Page to a Theme
app.post('/api/theme/:id/pages', async (req, res) => {
    try {
        const { name, html } = req.body;
        const theme = await Theme.findById(req.params.id);

        if (!theme) {
            return res.status(404).send({ error: 'Theme not found' });
        }

        theme.pages.push({ name, html });
        await theme.save();
        res.status(201).send(theme);
    } catch (err) {
        res.status(500).send({ error: 'Failed to add page', details: err.message });
    }
});

// Delete a Page from a Theme (but protect the "Home" page)
app.delete('/api/theme/:id/pages/:pageName', async (req, res) => {
    try {
        const theme = await Theme.findById(req.params.id);

        if (!theme) {
            return res.status(404).send({ error: 'Theme not found' });
        }

        // Prevent deleting the "Home" page
        if (req.params.pageName === 'Home') {
            return res.status(400).send({ error: 'Cannot delete the Home page.' });
        }

        // Remove the selected page
        theme.pages = theme.pages.filter((page) => page.name !== req.params.pageName);

        // Save the updated theme after the page has been deleted
        await theme.save();

        res.send({ message: `Page "${req.params.pageName}" deleted successfully` });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete page', details: err.message });
    }
});

// Update a Page's HTML for a Theme (Edit and Save)
app.put('/api/theme/:id/page', async (req, res) => {
    const { pageName, html } = req.body;

    try {
        const theme = await Theme.findById(req.params.id);  // Check if theme exists

        if (!theme) {
            return res.status(404).send({ error: 'Theme not found' });
        }

        // Find the specific page within the theme and update its HTML
        const page = theme.pages.find((p) => p.name === pageName);
        if (page) {
            page.html = html;  // Update the page's HTML content
            await theme.save();  // Save the updated theme with the modified page
            return res.send({ message: 'Page updated successfully', theme });
        } else {
            return res.status(404).send({ error: `Page "${pageName}" not found in theme.` });
        }
    } catch (err) {
        return res.status(500).send({ error: 'Failed to update page', details: err.message });
    }
});

// 9. Save All Pages for a Theme
app.put('/api/theme/:id/pages', async (req, res) => {
    const { pages } = req.body;

    try {
        const theme = await Theme.findById(req.params.id);

        if (!theme) {
            return res.status(404).send({ error: 'Theme not found' });
        }

        theme.pages = pages;  // Overwrite the pages array
        await theme.save();
        res.send({ message: 'Theme pages updated successfully', theme });
    } catch (err) {
        res.status(500).send({ error: 'Failed to save pages', details: err.message });
    }
});

// 10. Delete a Category (and its themes)
app.delete('/api/category/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).send({ error: 'Category not found' });
        }
        // Optionally: Delete related themes when a category is deleted
        await Theme.deleteMany({ category: category.name });
        res.send({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete category', details: err.message });
    }
});



// 🔹 API: Delete a Theme
app.delete("/api/theme/:id", async (req, res) => {
    try {
        const deletedTheme = await Theme.findByIdAndDelete(req.params.id);
        if (!deletedTheme) {
            return res.status(404).json({ error: "Theme not found" });
        }
        res.json({ message: "Theme deleted successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete theme" });
    }
});

// Define User Schema
// Define User Schema
const UserSchema = new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true },
    phone: String,
    password: String,
    appointments: [{
        templateName: String,
        date: String,
        time: String,
        customizationDetails: String
    }]
});

const User = mongoose.model("User", UserSchema);

// 🔹 Check If Email Exists
app.get("/api/user/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 Register & Save User Data
app.post("/api/register", async (req, res) => {
    try {
        const { fullName, email, phone, password, templateName, date, time, customizationDetails } = req.body;

        let user = await User.findOne({ email });

        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ fullName, email, phone, password: hashedPassword, appointments: [] });
        }

        user.appointments.push({ templateName, date, time, customizationDetails });
        await user.save();

        res.status(201).json({ message: "✅ User registered & appointment scheduled!" });
    } catch (err) {
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

// 🔹 Login User
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ error: "User not found. Please sign up." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Incorrect password" });

        res.json({ message: "✅ Login successful", user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});
// Define Schema & Model
const ScheduleSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    templateName: String,
    scheduleDate: { type: String, required: true },
    scheduleTime: { type: String, required: true },
    scheduleNotes: String
});
const Schedule = mongoose.model("Schedule", ScheduleSchema);

// API: Save Form Data
app.post("/api/schedule", async (req, res) => {
    try {
        console.log("📥 Received Schedule Data:", req.body);
        const schedule = new Schedule(req.body);
        await schedule.save();
        res.status(201).json({ message: "✅ Schedule saved successfully!" });
    } catch (error) {
        console.error("❌ Error saving schedule:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API: Get Schedules for a Specific User
app.get("/api/schedules/:email", async (req, res) => {
    try {
        const email = req.params.email;
        const schedules = await Schedule.find({ email: email });
        res.json(schedules);
    } catch (error) {
        console.error("❌ Error fetching schedules:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// API: Get all users with their schedules
app.get("/api/admin/schedules", async (req, res) => {
    try {
        const users = await Schedule.aggregate([
            { $group: { _id: "$email", fullName: { $first: "$fullName" }, phone: { $first: "$phone" }, schedules: { $push: "$$ROOT" } } }
        ]);
        res.json(users);
    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// API: Get new request count
app.get("/api/admin/new-requests", async (req, res) => {
    try {
        const newRequests = await Schedule.countDocuments({ isCompleted: false });
        res.json({ count: newRequests });
    } catch (error) {
        console.error("❌ Error fetching new requests:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API: Mark schedule as completed
app.put("/api/admin/complete/:id", async (req, res) => {
    try {
        const scheduleId = req.params.id;
        await Schedule.findByIdAndUpdate(scheduleId, { isCompleted: true });
        res.json({ message: "✅ Schedule marked as completed!" });
    } catch (error) {
        console.error("❌ Error updating schedule:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API: Assign template to user
app.put("/api/admin/assign-template/:id", async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const { templateName } = req.body;
        await Schedule.findByIdAndUpdate(scheduleId, { templateName });
        res.json({ message: "✅ Template assigned successfully!" });
    } catch (error) {
        console.error("❌ Error assigning template:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ---- START SERVER ----
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
