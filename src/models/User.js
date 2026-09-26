import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      require: true,
      unique: true
    },
    email: {
      type: String,
      require: true,
      unique: true
    },
    mobile:{
      type: String,
      required : true,
      unique: true,
    },
    password: {
      type: String,
      require: true,
    },
    confirmPassword: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      default: "user"
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User

