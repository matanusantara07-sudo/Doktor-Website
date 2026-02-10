import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export async function uploadWordPressPost(title, content, author) {
  try {
    const wpUrl = process.env.WP_URL;
    const wpUsername = process.env.WP_USERNAME;
    const wpPassword = process.env.WP_PASSWORD;

    if (!wpUrl || !wpUsername || !wpPassword) {
      return {
        success: false,
        error: 'WordPress credentials not configured'
      };
    }

    const response = await axios.post(
      `${wpUrl}/wp-json/wp/v2/posts`,
      {
        title,
        content,
        status: 'publish',
        author: 1
      },
      {
        auth: {
          username: wpUsername,
          password: wpPassword
        }
      }
    );

    return {
      success: true,
      postId: response.data.id,
      url: response.data.link
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

export async function updateWordPressStatus(postId, status) {
  try {
    const wpUrl = process.env.WP_URL;
    const wpUsername = process.env.WP_USERNAME;
    const wpPassword = process.env.WP_PASSWORD;

    if (!wpUrl || !wpUsername || !wpPassword) {
      return {
        success: false,
        error: 'WordPress credentials not configured'
      };
    }

    await axios.post(
      `${wpUrl}/wp-json/wp/v2/posts/${postId}`,
      {
        status
      },
      {
        auth: {
          username: wpUsername,
          password: wpPassword
        }
      }
    );

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

export async function checkWordPressConnection() {
  try {
    const wpUrl = process.env.WP_URL;
    const wpUsername = process.env.WP_USERNAME;
    const wpPassword = process.env.WP_PASSWORD;

    if (!wpUrl || !wpUsername || !wpPassword) {
      return {
        success: false,
        message: 'WordPress credentials not configured',
        details: {
          wpUrl: !!wpUrl,
          wpUsername: !!wpUsername,
          wpPassword: !!wpPassword
        }
      };
    }

    const response = await axios.get(
      `${wpUrl}/wp-json/wp/v2/users/me`,
      {
        auth: {
          username: wpUsername,
          password: wpPassword
        }
      }
    );

    return {
      success: true,
      message: 'WordPress connection successful',
      details: {
        url: wpUrl,
        user: response.data.name,
        userId: response.data.id
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'WordPress connection failed',
      details: {
        error: error.response?.data?.message || error.message
      }
    };
  }
}
