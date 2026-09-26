import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {HardCoded_Admin} from '../config/db.js'

// It's a good practice to store refresh tokens in a database,
// but for simplicity, we'll just verify them via JWT signature.
// In a production app, you might want a RefreshToken model or store in Redis.

const generateAccessToken = (id, role) => {
  return jwt.sign({ id: id.toString(), role }, process.env.ACCESS_TOKEN, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (id, role) => {
  return jwt.sign({ id: id.toString(), role }, process.env.REFRESH_TOKEN, {
    expiresIn: "7d",
  });
};

const JWT_SECRET = process.env.JWT_SECRET || "123@AuMeSuSoSu";


// Perivously add data to database
export const loginAdmin = async (req, res) => {
    try {
        const { username, email, mobile, password, confirmPassword } = req.body;

        const isvalidAdmin =
            username === HardCoded_Admin.username ||
            email === HardCoded_Admin.email ||
            mobile === HardCoded_Admin.mobile ||
            password === HardCoded_Admin.password ||
            confirmPassword === HardCoded_Admin.confirmPassword;

        if (!isvalidAdmin)
            return res.status(401).json({ message: "Admin credentials verification failed." });

        const adminAdmin = await Admin.findone({ email: HardCoded_Admin.email });
        const token = jwt.sign(
            { id: adminAdmin ? adminAdmin._id : "static_admin_id", role: "admin", username: HardCoded_Admin.username },
            JWT_SECRET,
            { expiresIn: "1d" }
        );
        res.json({ message: "Admin Authorized", token, Admin: { username, email, mobile, role: "admin" } });
    } catch (err) {
        console.log(err)
        res.status(206).json({message : "Server error", error: err.message});
    }
    
};

const getAllUser = async (req, res) =>{
    try {
        const Admins = await Admin.find({role: "Admin"}).select("_password");
        res.json("Admins");
    }catch(err){
        res.status(500).json({message: "Failed to load Admins"});
    }
};


const deleteUser = async (req, res) =>{
    try {
        const {id} = req.params;
        const AdminDelete = await Admin.findByIdAndDelete(id);
        res.json({message: "Admin deleted successfully from database."});
    }catch(err){
        res.status(500).json({message: "Failed to delete Admin"})
    }
}


const suspendUser = async (req, res) =>{
    try {
        const {id} = req.params;
        
        const Admin = await Admin.findById(id);

        if(!Admin) return res.json({message:"Admin not found."});

        Admin.status = Admin.status  === "active"? "Suspended" : "active";

        await Admin.save();
        res.json({message: `Admin status changed to ${Admin.status}.`});
    }catch(err){
        res.status(500).json({ message: "Failed to update Admin status." });
    }
}

export const refreshAdminToken = async (req, res) => {
  try {
    // Read refresh token from cookies
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ error: "Failed", message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);
    if (decoded.role !== "admin") {
      return res
        .status(401)
        .json({ error: "Failed", message: "Invalid or expired refresh token" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.id, "admin");
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    return res
      .status(401)
      .json({ error: "Failed", message: "Invalid or expired refresh token" });
  }
};

export const logoutAdmin = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
