import User from "../models/User.js";
// import Admin  from "../models/Admin.js";
import { Comment } from "../models/Comment.js";
import { Recipe } from "../models/Recipe.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

// POST /api/User/signup
export const signupUser = async (req, res) => {
  try {
    let { username, email, mobile, password, confirmPassword } = req.body;
    username = username?.trim();
    email = email?.trim();
    mobile = String(mobile ?? "").trim().replace(/[\s-]/g, "");
    password = password?.trim();
    confirmPassword = confirmPassword?.trim();


    if (!username || !email || !mobile || !password || !confirmPassword) {
      return res.status(401).json({ error: "Failed", message: "Empty input failed" });
    }
    if (!/^[a-zA-Z]*$/.test(username)) {
      return res.status(401).json({ error: "Failed", message: "Failed username format" });
    }
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.status(401).json({ error: "Failed", message: "Failed email format" });
    }
    if (/^\+91[6-9]\d{9}$/.test(mobile)) {
      mobile = mobile.slice(3);
    } else if (/^91[6-9]\d{9}$/.test(mobile)) {
      mobile = mobile.slice(2);
    } else if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(401).json({
        error: "failed",
        message: "Failed mobile number format."
      });
    }
    if (password.length < 8) {
      return res.status(401).json({ error: "Failed", message: "Failed password format" });
    }
    if (confirmPassword.length < 8) {
      return res.status(401).json({ error: "Failed", message: "Failed password format" });
    }
    if (confirmPassword != password) {
      return res.status(401).json({ error: "Failed", message: "Password not matched." })
    }
    if (password.length < 8) {
      return res.status(401).json({ error: "Failed", message: "Failed password format" });
    }

    // Check if alredy exsits

    const existingUser = await User.findOne({ email }, { username });
    if (existingUser) {
      return res.status(409).json({ error: "Failed", message: "User with the provided email already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUsers = new User({
      username,
      email,
      mobile,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: "user"
    });
    await newUsers.save();

    const accessToken = generateAccessToken(newUsers._id, "User");
    const refreshToken = generateRefreshToken(newUsers._id, "User");

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: "Account created successfully",
      accessToken,
      newUsers: {
        id: newUsers._id,
        username: newUsers.username,
        email: newUsers.email,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// POST /api/User/login
export const loginUser = async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Failed", message: "Email and password are required" });
    }

    // Normalize identifier
    identifier = String(identifier).trim();

    // Normalize mobile number
    let mobileIdentifier = identifier.replace(/[\s-]/g, "");

    if (/^\+91[6-9]\d{9}$/.test(mobileIdentifier)) {
      mobileIdentifier = mobileIdentifier.slice(3);
    } else if (/^91[6-9]\d{9}$/.test(mobileIdentifier)) {
      mobileIdentifier = mobileIdentifier.slice(2);
    }

    // Find user

    const Users = await User.findOne({ $or: [{ email: identifier }, { mobile: identifier }, { username: identifier }] });
    if (!Users) {
      return res
        .status(401)
        .json({ error: "Failed", message: "Invalid credentials" });
    }

    // Check suspended account
    if (Users.status === "suspended") {
      return res
        .status(401)
        .json({ error: "Failed", message: "Your account is suspended by admin" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, Users.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: "Failed", message: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = generateAccessToken(Users._id, "User");
    const refreshToken = generateRefreshToken(Users._id, "User");

    // Refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Login response
    res.status(200).json({
      message: "Login Successful",
      accessToken,
      Users: {
        id: Users._id,
        username: Users.username,
        name: Users.name,
        email: Users.email,
        mobile: Users.mobile,
        role: Users.role,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// POST /api/User/refresh
export const refreshUserToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res
        .status(401)
        .json({ error: "Failed", message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);
    if (decoded.role !== "User") {
      return res
        .status(401)
        .json({ error: "Failed", message: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateAccessToken(decoded.id, "User");

    let UserObj = undefined;
    try {
      const Users = await User.findById(decoded.id).select("-password");
      if (Users) {
        UserObj = {
          id: Users._id,
          username: Users.username,
          name: Users.name,
          email: Users.email,
        };
      }
    } catch (e) {
      // Ignore DB lookup error for token refresh
    }

    return res.status(200).json({ accessToken: newAccessToken, Users: UserObj });
  } catch (error) {
    return res
      .status(401)
      .json({ error: "Failed", message: "Invalid or expired refresh token" });
  }
};

// POST /api/User/logout
export const logoutUser = async (req, res) => {
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

// GET /api/User/profile
// Protected — get current User profile
export const getUserProfile = async (req, res) => {
  try {
    const Users = await User.findById(req.Users.id).select("-password");
    if (!Users) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "User not found" });
    }
    res.status(200).json({
      Users: {
        id: Users._id,
        username: Users.username,
        name: Users.name,
        email: Users.email,
        createdAt: Users.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// PUT /api/User/profile
// Protected — update User display name
export const updateUserProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (name !== undefined && typeof name !== "string") {
      return res
        .status(400)
        .json({ error: "Validation", message: "Name must be a string" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();

    const Users = await User.findByIdAndUpdate(
      req.Users.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!Users) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "User not found" });
    }

    // Sync updated authorName across all recipes authored by this User
    const updatedAuthorName =
      Users.name && Users.name.trim() ? Users.name.trim() : Users.username;
    await Recipe.updateMany(
      { author: Users._id },
      { $set: { authorName: updatedAuthorName } }
    );

    res.status(200).json({
      message: "Profile updated successfully",
      Users: {
        id: Users._id,
        username: Users.username,
        name: Users.name,
        email: Users.email,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/User/commented-posts
// Protected — get all recipes the User has commented on
export const getCommentedPosts = async (req, res) => {
  try {
    const UserId = req.User.id;

    // Find distinct recipe IDs from User's comments
    const recipeIds = await Comment.find({ User: UserId }).distinct("recipe");

    // Fetch those recipes
    const recipes = await Recipe.find({
      _id: { $in: recipeIds },
      published: true,
    }).select("title slug description image authorName category createdAt");

    res.status(200).json({ recipes });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/User/my-posts
// Protected — get all recipes created by the current logged-in User
export const getMyPosts = async (req, res) => {
  try {
    const UserId = req.User.id;
    const recipes = await Recipe.find({ author: UserId })
      .sort({ createdAt: -1 })
      .select(
        "title slug description image authorName category createdAt published"
      );

    res.status(200).json({ recipes });
  } catch (error) {
    console.error("getMyPosts error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/User/search?q=query
// Public — search Users by username or display name
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(200).json({ Users: [] });
    }

    const queryRegex = new RegExp(q.trim(), "i");
    const Users = await User.find({
      $or: [{ username: queryRegex }, { name: queryRegex }],
    })
      .select("username name createdAt")
      .limit(20);

    res.status(200).json({ Users });
  } catch (error) {
    console.error("searchUsers error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/User/public/:username
// Public — get public User details and published posts (excludes comments)
export const getPublicUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const Users = await User.findOne({
      username: { $regex: `^${username.trim()}$`, $options: "i" },
    }).select("username name createdAt");

    if (!Users) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "User not found" });
    }

    // Fetch published recipes created by this User
    const recipes = await Recipe.find({
      author: Users._id,
      published: true,
    })
      .sort({ createdAt: -1 })
      .select(
        "title slug description image authorName category tags cookTime prepTime servings createdAt"
      );

    res.status(200).json({
      Users: {
        id: Users._id,
        username: Users.username,
        name: Users.name,
        createdAt: Users.createdAt,
      },
      recipes,
    });
  } catch (error) {
    console.error("getPublicUserProfile error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};
