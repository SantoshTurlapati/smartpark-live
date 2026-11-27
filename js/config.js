/*
 * SmartPark deployment configuration.
 * Local development uses Spring Boot; deployed pages use the hosted API.
 */
const isLocalSmartPark = ["localhost", "127.0.0.1"].includes(window.location.hostname);
window.SMARTPARK_API = isLocalSmartPark
  ? "http://localhost:8081"
  : "https://smartpark-api-izfu.onrender.com";
