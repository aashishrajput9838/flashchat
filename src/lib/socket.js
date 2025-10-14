import { io } from "socket.io-client";

// Initialize socket connection
const socket = io("http://localhost:3001");

export default socket;