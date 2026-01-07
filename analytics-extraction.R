# Google Analytics 4 Data Extraction Script for FlashChat
# Social Media Analytics - Experiment 1
# Author: Aashish Rajput

# Load required libraries
library(googleAnalyticsR)
library(ggplot2)
library(dplyr)
library(tidyr)
library(lubridate)

# Authenticate with Google Analytics
# Note: Run this once to authenticate, token will be saved for future use
# ga_auth()

# Function to extract GA4 data
extract_ga4_data <- function(property_id, start_date = "30daysAgo", end_date = "yesterday") {
  # Get analytics data from GA4
  # Replace YOUR_PROPERTY_ID with your actual GA4 Property ID
  ga_data <- google_analytics_4(
    property_id, 
    date_range = c(start_date, end_date),
    metrics = c("sessions", "users", "engagement_rate", "page_views"),
    dimensions = c("date", "page_location", "session_default_channel_group"),
    anti_sample = TRUE
  )
  
  return(ga_data)
}

# Function to extract session data specifically
extract_session_data <- function(property_id, start_date = "30daysAgo", end_date = "yesterday") {
  session_data <- google_analytics_4(
    property_id,
    date_range = c(start_date, end_date),
    metrics = "sessions",
    dimensions = "date",
    anti_sample = TRUE
  )
  
  # Convert date column to proper date format
  session_data$date <- as.Date(session_data$date)
  
  return(session_data)
}

# Function to extract user engagement data
extract_engagement_data <- function(property_id, start_date = "30daysAgo", end_date = "yesterday") {
  engagement_data <- google_analytics_4(
    property_id,
    date_range = c(start_date, end_date),
    metrics = c("users", "engaged_sessions", "engagement_rate", "average_session_duration"),
    dimensions = "date",
    anti_sample = TRUE
  )
  
  # Convert date column to proper date format
  engagement_data$date <- as.Date(engagement_data$date)
  
  return(engagement_data)
}

# Function to extract page view data
extract_pageview_data <- function(property_id, start_date = "30daysAgo", end_date = "yesterday") {
  pageview_data <- google_analytics_4(
    property_id,
    date_range = c(start_date, end_date),
    metrics = "page_views",
    dimensions = c("page_location", "date"),
    anti_sample = TRUE
  )
  
  # Convert date column to proper date format
  pageview_data$date <- as.Date(pageview_data$date)
  
  return(pageview_data)
}

# Example usage:
# Replace 'YOUR_PROPERTY_ID' with your actual GA4 Property ID
# property_id <- "YOUR_PROPERTY_ID"

# Extract different types of data
# sessions_data <- extract_session_data(property_id)
# engagement_data <- extract_engagement_data(property_id)
# pageview_data <- extract_pageview_data(property_id)

# Print sample of data
# print(head(sessions_data))
# print(summary(sessions_data))

# Save data to CSV files
# write.csv(sessions_data, "ga_sessions_data.csv", row.names = FALSE)
# write.csv(engagement_data, "ga_engagement_data.csv", row.names = FALSE)
# write.csv(pageview_data, "ga_pageview_data.csv", row.names = FALSE)

print("Google Analytics 4 data extraction functions created successfully!")
print("To use these functions, uncomment and modify the example usage section with your actual Property ID.")