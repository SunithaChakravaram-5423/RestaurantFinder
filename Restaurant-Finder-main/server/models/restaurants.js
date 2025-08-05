const mongoose=require("mongoose");

const restaurantSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    cuisines: { type: String },
    price_range: { type: Number },
    location: {
        latitude: { type: String },
        longitude: { type: String },
        address: { type: String },
        city: { type: String },
        country_id: { type: Number },
        locality_verbose: { type: String },
        city_id: { type: Number },
        zipcode: { type: String },
        locality: { type: String }
    },
    user_rating: {
        rating_text: { type: String },
        rating_color: { type: String },
        votes: { type: String },
        aggregate_rating: { type: String }
    },
    menu_url: { type: String },
    featured_image: { type: String },
    has_table_booking: { type: Boolean },
    has_online_delivery: { type: Boolean },
    url: { type: String },
    photos_url: { type: String },
    events_url: { type: String },
    average_cost_for_two: { type: Number },
    offers: { type: Array, default: [] },
    is_delivering_now: { type: Boolean },
    deeplink: { type: String },
    switch_to_order_menu: { type: Boolean },
    R_res_id: { type: Number },
    zomato_events: { type: Array, default: [] }
});

const Restaurants = mongoose.model("Restaurants", restaurantSchema);
module.exports=Restaurants;
