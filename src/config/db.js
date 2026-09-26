import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";

const hashPassword = async (password) => await bcrypt.hash(password, 10);

export const HardCoded_Admin = {
    username: "adminAdmin" || "Armehebub",
    email: "admin@example.com" || "peacepeace6321@gmail.com",
    mobile: "9876543210",
    password: "AdminPassword123!",
    confirmPassword: "AdminPassword123!"
};

const connectDB = async () => {
        const seedAdmin = async () => {
            try {
                const existAdmin = await Admin.findOne({
                    $or: [{
                        email: HardCoded_Admin.email
                    },
                    { username: HardCoded_Admin.username }
                    ]
                });
                if (!existAdmin) {
                    const hashpassword = await bcrypt.hash(HardCoded_Admin.password, 10);
                    const newAdmin = await Admin.create({
                        username: HardCoded_Admin.username,
                        email: HardCoded_Admin.email,
                        mobile: HardCoded_Admin.mobile,
                        password: HardCoded_Admin.password,
                        role: "admin"
                    });
                    console.log("Predefined Admin created in DB.");
                }
            } catch (err) {
                console.log("Admin seeding error", err.message)
            }
        }
        try {
        await mongoose.connect(process.env.MONGODB2_URI);
        console.log(`✅ MongoDB Connected`);
        seedAdmin();
    } catch (err) {
        console.error(`❌ Database connection error: ${err.message}`);
    }
};

export default connectDB;
