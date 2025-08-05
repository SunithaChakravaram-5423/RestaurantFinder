const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const Clarifai = require("clarifai");
const dotenv = require("dotenv");
const { ObjectId } = require("mongoose").Types;

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.error("❌ MongoDB Connection Error:", err));

const RestaurantSchema = new mongoose.Schema({}, { strict: false });
const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

const clarifaiApp = new Clarifai.App({
  apiKey: process.env.CLARIFAI_API_KEY,
});

// ✅ Use Memory Storage (Temporary Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 GET All Restaurants with Pagination
app.get("/restaurants", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();

    // 🔍 Just log 1st 5 locations for checking
    restaurants.forEach((r, i) => {
      console.log(`Restaurant ${i + 1}:`, r.name, r.location);
    });


    res.json({ total: restaurants.length, restaurants });
  } catch (error) {
    res.status(500).json({ message: "❌ Error fetching restaurants", error });
  }
});


// 🔹 GET Restaurant by ID
app.get("/restaurants/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ _id: new ObjectId(req.params.id) });
    if (!restaurant) {
      return res.status(404).json({ message: "❌ Restaurant not found" });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: "❌ Error fetching restaurant", error });
  }
});

// 🔹 Search Restaurants by Cuisine
app.get("/restaurants-by-cuisine", async (req, res) => {
  try {
    const { cuisine } = req.query;

    if (!cuisine) {
      return res.status(400).json({ message: "❌ Cuisine parameter is required" });
    }

    // Search for restaurants where cuisines contain the given cuisine term (case-insensitive)
    const restaurants = await Restaurant.find({
      $or: [
        { cuisines: { $regex: new RegExp(`\\b${cuisine}\\b`, "i") } }, // Match cuisine in the cuisines field
        { name: { $regex: new RegExp(`\\b${cuisine}\\b`, "i") } } // Match cuisine term in the restaurant name
      ]
    });
    res.json({ total: restaurants.length, restaurants });
  } catch (error) {
    res.status(500).json({ message: "❌ Error fetching restaurants by cuisine", error: error.message });
  }
});



// 🔹 Search Restaurants by Location
app.get("/location", async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radInKm = parseFloat(radius);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ message: "❌ Invalid latitude or longitude" });
    }

    // Approximate conversion: 1 degree ≈ 111 km
    const degreeRadius = radInKm / 111;

    const restaurants = await Restaurant.find({
      "location.latitude": { $gte: lat - degreeRadius, $lte: lat + degreeRadius },
      "location.longitude": { $gte: lon - degreeRadius, $lte: lon + degreeRadius },
    });

    res.json({ total: restaurants.length, restaurants });
  } catch (error) {
    console.error("❌ Location search error:", error);
    res.status(500).json({ message: "❌ Error fetching restaurants by location", error });
  }
});


// 🔹 AI-Based Image Search for Restaurants (Using Memory Storage)
app.post("/search-by-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "❌ No image uploaded" });
    }

    // ✅ Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString("base64");

    // 🔹 Send image to Clarifai API for analysis
    const clarifaiResponse = await clarifaiApp.models.predict(Clarifai.FOOD_MODEL, { base64: imageBase64 });

    if (!clarifaiResponse || !clarifaiResponse.outputs[0].data.concepts) {
      return res.status(500).json({ success: false, message: "❌ Clarifai analysis failed" });
    }

    // ✅ Extract relevant cuisine tags
    const cuisineTerms = [
      // Common International Cuisines
      "pizza", "sushi", "burger", "pasta", "chinese", "indian", "mexican", "italian", "thai", "japanese",  
      "korean", "vietnamese", "greek", "french", "spanish", "mediterranean", "american", "british", "turkish",  
      "lebanese", "brazilian", "argentinian", "german", "caribbean", "persian", "russian", "african",  
    
      // Meat-Based Dishes  
      "steak", "barbecue", "bbq", "ribs", "brisket", "meat", "lamb", "mutton", "beef", "pork", "chicken", "duck",  
      "kebab", "shawarma", "biryani", "tandoori", "roast", "grilled", "fried chicken", "teriyaki",  
    
      // Seafood  
      "fish", "lobster", "shrimp", "crab", "oyster", "salmon", "tuna", "calamari", "seafood", "grilled fish",  
    
      // Street Food & Fast Food  
      "hot dog", "tacos", "burrito", "quesadilla", "nachos", "dim sum", "dumplings", "bao", "noodles", "ramen",  
    
      // Vegetarian & Vegan Options  
      "vegetarian", "vegan", "salad", "tofu", "paneer", "falafel", "hummus", "lentil", "legumes", "plant-based",  
    
      // Desserts & Bakery  
      "cake", "ice cream", "pastry", "donut", "waffle", "brownie", "cookies", "chocolate", "pudding",  
      "cheesecake", "mousse", "macaron", "gelato", "custard", "tart",  
      // Beverages  
      "coffee", "tea", "smoothie", "milkshake", "juice", "cocktail", "mocktail", "wine", "beer", "whiskey"  
    ];
    
    const searchTags = clarifaiResponse.outputs[0].data.concepts
      .filter(concept => concept.value > 0.85)
      .map(concept => concept.name.toLowerCase())
      .filter(tag => cuisineTerms.includes(tag));

    if (searchTags.length === 0) {
      return res.json({ success: false, message: "❌ No relevant cuisine detected in the image." });
    }
    
    const regexPatterns = searchTags.map(tag => new RegExp(tag, "i"));
    const restaurants = await Restaurant.find({
      $or: [
        { cuisines: { $in: regexPatterns } }, // Match cuisines
        { name: { $in: regexPatterns } } // Match restaurant names
      ]
    });
    console.log(restaurants);
    // Debugging log (optional, remove later)
    console.log("Detected Tags:", searchTags);
    console.log("Found Restaurants:", restaurants.length);

    console.log("Clarifai Response:", clarifaiResponse);
    console.log("Extracted Tags:", searchTags);

    res.json({ success: true, searchTags, total: restaurants.length, restaurants });
  } catch (error) {
    res.status(500).json({ success: false, message: "❌ Image processing failed", error: error.message });
  }
});



app.listen(5000, () => console.log("✅ Server running on port 5000"));
