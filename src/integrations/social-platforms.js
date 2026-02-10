import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export async function publishToFacebook(title, content) {
  try {
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!accessToken || !pageId) {
      return {
        success: false,
        error: 'Facebook credentials not configured'
      };
    }

    const message = `${title}\n\n${content}`;

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        message,
        access_token: accessToken
      }
    );

    return {
      success: true,
      url: `https://facebook.com/${response.data.id}`,
      postId: response.data.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

export async function publishToTwitter(title, content) {
  try {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return {
        success: false,
        error: 'Twitter credentials not configured'
      };
    }

    // Truncate content to fit Twitter's character limit
    const maxLength = 280;
    let tweet = `${title}\n\n${content}`;
    if (tweet.length > maxLength) {
      tweet = tweet.substring(0, maxLength - 3) + '...';
    }

    // Note: This is a simplified example. In production, use a proper OAuth library
    return {
      success: false,
      error: 'Twitter API implementation requires OAuth 1.0a authentication. Please implement using a proper library like twitter-api-v2.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function publishToInstagram(title, content) {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !businessAccountId) {
      return {
        success: false,
        error: 'Instagram credentials not configured'
      };
    }

    // Note: Instagram requires an image or video. This is a simplified placeholder.
    return {
      success: false,
      error: 'Instagram API requires media (image/video) to publish. Text-only posts are not supported.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
