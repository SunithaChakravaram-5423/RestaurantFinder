const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Restaurants = require("./models/restaurants");

dotenv.config();

// Check if .env is loading correctly
console.log("🔍 Checking MONGO_URI:", process.env.MONGO_URI);
if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is undefined! Check your .env file.");
    process.exit(1);
}

const connectDB = async () => {
    try {
        console.log("🔍 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("✅ MongoDB Atlas Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    }
};

const loadData = async () => {
    try {
        console.log("🔍 Starting Data Load...");
        await connectDB();

        // Read JSON file
        console.log("🔍 Reading JSON file...");
        const rawData = fs.readFileSync("file5.json");
        console.log("✅ JSON file read successfully");

        const jsonData = JSON.parse(rawData);

        if (!Array.isArray(jsonData)) {
            throw new Error("❌ Invalid JSON structure: Expected an array at the root");
        }

        console.log(`🔍 Processing ${jsonData.length} entries...`);

        const formattedData = jsonData.flatMap(entry => {
            if (!entry.restaurants || !Array.isArray(entry.restaurants)) {
                console.error("❌ Error: Missing or invalid 'restaurants' array in entry:", entry);
                return [];
            }

            return entry.restaurants.map(r => {
                const restaurant = r.restaurant;
                return {
                    id: restaurant?.id,
                    name: restaurant?.name,
                    cuisines: restaurant?.cuisines,
                    price_range: restaurant?.price_range,
                    location: restaurant?.location,
                    user_rating: restaurant?.user_rating,
                    menu_url: restaurant?.menu_url,
                    featured_image: restaurant?.featured_image,
                    has_table_booking: restaurant?.has_table_booking,
                    has_online_delivery: restaurant?.has_online_delivery,
                    url: restaurant?.url,
                    photos_url: restaurant?.photos_url,
                    book_url: restaurant?.book_url,
                    events_url: restaurant?.events_url,
                    average_cost_for_two: restaurant?.average_cost_for_two,
                    offers: restaurant?.offers || [],
                    is_delivering_now: restaurant?.is_delivering_now,
                    deeplink: restaurant?.deeplink,
                    switch_to_order_menu: restaurant?.switch_to_order_menu,
                    R_res_id: restaurant?.R?.res_id,
                    zomato_events: restaurant?.zomato_events || []
                };
            });
        });

        if (formattedData.length === 0) {
            throw new Error("❌ No valid restaurant data found to insert.");
        }

        console.log(`🔍 Preparing to insert ${formattedData.length} records into MongoDB...`);

        const bulkOps = formattedData.map(entry => ({
            updateOne: {
                filter: { id: entry.id }, // Match existing document by ID
                update: { $set: entry }, // Update with new data
                upsert: true // Insert if not exists, update if exists
            }
        }));

        await Restaurants.bulkWrite(bulkOps);
        console.log("✅ Data inserted/updated successfully");

        mongoose.connection.close();
        console.log("🔍 MongoDB Connection Closed.");
    } catch (error) {
        console.error("❌ Error inserting data:", error.message);
        mongoose.connection.close();
    }
};

loadData();
