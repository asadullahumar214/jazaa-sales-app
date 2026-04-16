import fs from 'fs';

const extracted = JSON.parse(fs.readFileSync('extracted_rates.json'));
const excelData = extracted["Main"].slice(2); // Skip headers

// Supabase names from the previous tool output
const supabaseNames = [
  "Acacia Honey 250GM", "Dal Chana 200GM", "Dal Moong 200GM", "Dal Moth 200GM", 
  "Fiery Chicken Potato Sticks 180GM", "Gathia 200GM", "Hot Sizzling Potato Sticks 180GM",
  "Ketchup Tango Potato Sticks 180GM", "Khatta Meetha Mix (Mini) 40GM", "Khatta Meetha Mix 200GM",
  "Mix Nimco (Mini) 40GM", "Badam Kheer Mix 155GM", "Red Chilli Powder 100GM", 
  "Red Chilli Powder 50GM", "Turmeric Powder 100GM", "Turmeric Powder 50GM", 
  "White Pepper Powder 50GM", "Hyderabadi Pulao 25GM", "Mughlai Qorma 25GM", 
  "Peshawari Karahi 25GM", "Riwaiti Achar Gosht 25GM", "Special Tikka 25GM", 
  "Traditional Bombay Biryani 30GM", "Malai Boti 60GM", "Authentic Sindhi Biryani 120GM",
  "Broast Mix 125GM", "Chapli Kabab Masala 100GM", "Chicken Masala 50GM", 
  "Daighi Beef Biryani 60GM", "Delhi Nihari 60GM", "Fish Masala 50GM", 
  "Fried Fish 50GM", "Haleem Masala 50GM", "Hyderabadi Pulao 65GM", 
  "Karachi Biryani Masala 60GM", "Koyla Karhai 40GM", "Mughlai Qorma 50GM", 
  "Paya Masala 50GM", "Peshawari Karahi 50GM", "Riwaiti Achar Gosht 50GM", 
  "Shahi Seekh Kabab 50GM", "Bread Crumbs 200GM", "Miswak", "Baking Powder 50GM", 
  "Banana Jelly 80GM", "Blackcurrant Flavor Jelly 80GM", "Blueberry Flavor Jelly 80GM", 
  "Cocoa Powder 50GM", "Corn Flour 250GM", "Chocolate Cake Rusk 350GM", 
  "Classic Chocolate Cookies 240GM", "Cumin Delight Cookies 200GM", "Cumin Puff Pastry 200GM", 
  "Lazo Puff Pastry 200GM", "Palmiers Puff Pastry 200GM", "Strawberry Jam Cookies 200GM", 
  "Steam Pre Clean (Ziafat) 25KG", "Biryani Masala 1KG", "Tikka Boti 1KG", 
  "Peshawari Karahi Masala 1KG", "Riwaiti Achar Gosht 1KG", "Cream Caramel 80GM", 
  "Kheer Mix 155GM", "Mango Custard 250GM", "Mango Jelly 80GM", "Mango Pudding Mix 80GM", 
  "Orange Flavor Jelly 80GM", "Pineapple Flavor Jelly 80GM", "Pista Kheer Mix 155GM", 
  "Pistachio Pudding Mix 80GM", "Pudding Mix 80GM", "Rabri Flavor Falooda 220GM", 
  "Raspberry Flavor Jelly 80GM", "Raspberry Pudding Mix 80GM", "Sheer Khurma 160GM", 
  "Strawberry Custard 250GM", "Strawberry Jelly 80GM", "Vanila Custard 250GM", 
  "Chocolate Custard 90GM", "Gelatine Powder 50GM", "Rasmalai 75Gm", 
  "Strawberry Flavor Falooda 220GM", "Fried Onion 400GM", "Ispaghol 95GM", 
  "Meat Tenderizer 40GM", "Pheni 200GM", "Vermicelli 100GM", "Vermicelli 150GM", 
  "Blackseed Oil 125ML", "Castor Oil 125ML", "Coconut Oil 125ML", "Mustard Oil 125ML", 
  "Sesame Oil 125ML", "Sidr Honey 250GM", "Sidr Honey 500GM", "Refined Salt 800GM", 
  "Black Pepper Potato Sticks (Mini) 40GM", "Black Pepper Potato Sticks 180GM", 
  "Chaat Papri 200GM", "Dahi Boondi 200GM", "Nimco Mix 200GM", "Peri Crunch Potato Sticks 180GM", 
  "Salty Potato Sticks 180GM", "Spicy Potato Sticks 180GM", "Bareek Boondi 200GM", 
  "Dahi Phulki 200GM", "Masala Papri 200GM", "Extra Virgin Olive Oil 500ML", 
  "Virgin Olive Oil 500ML", "Garlic Paste 330GM", "Garlic Paste 750GM", 
  "Ginger Garlic 330GM", "Ginger Garlic 750GM", "Ginger Paste 330GM", 
  "Ginger Paste 750GM", "Green Chilli Paste 330GM", "Papaya Paste 330GM", 
  "Onion Paste 330GM", "Acacia Honey 500GM", "Onion Paste 750GM", "Papaya Paste 750GM", 
  "Himalayan Pink Salt Fine Pouch 800GM", "Himalayan Pink Salt Glass Grinder 200GM", 
  "Himalayan Pink Salt Coarse Pouch 800GM", "Himalayan Pink Salt Plastic Grinder 220GM", 
  "Himalayan Pink Salt Shaker 500GM", "Black Pepper Powder 100GM", "Black Pepper Powder 50GM", 
  "Chat Masala 100GM", "Chat Masala 50GM", "Coriander Powder 100GM", 
  "Coriander Powder 50GM", "Cumin Powder 100GM", "Cumin Powder 50GM", 
  "Garam Masala 100GM", "Garlic Powder 100GM", "Garlic Powder 50GM", 
  "Ginger Powder 100GM", "Ginger Powder 50GM", 
  "Dried Fenugreek Leaves (Kasuri Methi) 25 GM", "Paprika Powder 50GM", 
  "Chatpata Tandoori Masala 100GM", "Daighi Beef Biryani 120GM", "Dehli Nihari 120GM", 
  "Fish Masala 100GM", "Fried Fish 100GM", "Haleem Mix 300GM", "Hyderabadi Pulao 130GM", 
  "Karachi Biryani Masala 120GM", "Koyla Karhai 80GM", "Mughlai Qorma 100GM", 
  "Peshawari Karhai 100GM", "Riwaiti Achar Gosht 100GM", "Shahi Seekh Kabab 100GM", 
  "Shami Kabab 100GM", "Special Tikka 100GM", "Traditional Bombay Biryani 120GM", 
  "Bihari Kabab 100GM", "Biryani Masala 90GM", "Butter Chicken 100GM", 
  "CHICKEN BIRYANI 110GM", "Chicken Masala 100GM", "Curry Kofta Masala 100GM", 
  "Curry Powder 200GM", "Haleem Masala 100GM", "Paya Masala 100GM", 
  "Tikka Boti 100GM", "Vegetable Masala 100GM", "Zaiqaydar Dum Qeema 100GM", 
  "Afghani Malai Boti 30GM", "Authentic Sindhi Biryani 60GM", "Bihari Kabab 50GM", 
  "Biryani Masala 45GM", "Butter Chicken 50GM", "Chatpata Tandoori Masala 50GM", 
  "CHICKEN BIRYANI 55GM", "Shami Kabab 50GM", "Special Tikka 50GM", "Tikka Boti 50GM", 
  "Traditional Bombay Biryani 60GM", "Zaiqaydar Dum Qeema 50GM", "Curry Kofta Masala 50GM", 
  "Vegetable Masala 50GM", "Basmati Rice (Red) 1KG", "Basmati Rice (Red) 5KG", 
  "Brown Basmati Rice 1.5KG", "Economy Rice (Blue) 1KG", "Economy Rice (Blue) 5KG", 
  "Elite Basmati Rice (Black) 1KG", "Elite Basmati Rice (Black) 5KG", 
  "Premium Basmati Rice (Silver) 5KG", "Premium Basmati Rice (Silver) 1KG", 
  "Rozmarrah Rice (Green) 1KG", "Rozmarrah Rice (Green) 5KG", "Sella Rice (Gold) 1KG", 
  "Sella Rice (Gold) 5KG", "Classic Rice 5KG", "Kifayat Rice 5KG", "Standard Rice 5KG", 
  "Jaam-E-Khaas Red Syrup 800ML", "Jaam-E-Khaas Ice Cream Syrup 800ML", 
  "Assorted Cookies 200GM", "Cake Rusk 350GM", "Choco Vanilla Cookies 240GM", 
  "Classic Chocolate Cookies 200GM", "Cumin Delight Cookies 240GM", "Naan Khatai 360GM", 
  "Strawberry Jam Cookies 240GM", "Sugar Puff Pastry 200GM", "Tea Rusk 220GM", 
  "Assorted Cookies 240GM", "Choco Vanilla Cookies 200GM"
];

const nameMap = {
    "Peshawari Karhai 100GM": "Peshawari Karahi 100GM",
    "Peshawari Karhai 50GM": "Peshawari Karahi 50GM",
    "Peshawari Karhai 25GM": "Peshawari Karahi 25GM",
    "Peshawari Karhai Masala 1KG": "Peshawari Karahi Masala 1KG",
    "Koyla Karhai 40GM": "Koyla Karhai 40GM",
    "Koyla Karhai 80GM": "Koyla Karhai 80GM"
};

const updates = [];
const misses = [];

supabaseNames.forEach(name => {
    const excelName = nameMap[name] || name;
    const match = excelData.find(row => row["__EMPTY"]?.trim().toLowerCase() === excelName.trim().toLowerCase());
    if (match) {
        updates.push({
            name,
            min_ur: Math.round(Number(match["__EMPTY_20"] || 0)),
            min_it: Math.round(Number(match["__EMPTY_27"] || 0)),
            min_reg: Math.round(Number(match["__EMPTY_34"] || 0))
        });
    } else {
        misses.push(name);
    }
});

let sql = "BEGIN;\n";
updates.forEach(u => {
    sql += `UPDATE inventory SET min_price_ur = ${u.min_ur}, min_price_it = ${u.min_it}, min_price_reg = ${u.min_reg} WHERE name = '${u.name.replace(/'/g, "''")}';\n`;
});
sql += "COMMIT;";

fs.writeFileSync('sync_prices.sql', sql);
console.log(`Prepared ${updates.length} updates. ${misses.length} misses.`);
if (misses.length > 0) {
    console.log("Misses:", misses);
}
