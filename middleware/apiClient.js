const axios = require('axios');

module.exports.getMembers = async (accessToken, campaignId) => {
  const response = await axios.get(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
    params: {
      include: 'address,currently_entitled_tiers,user',
      fields: {
        member: 'full_name,is_follower,last_charge_date,lifetime_support_cents,currently_entitled_amount_cents,patron_status',
        address: 'addressee,city,line_1,line_2,phone_number,postal_code,state',
        tier: 'amount_cents,created_at,description,discord_role_ids,edited_at,patron_count,published,published_at,requires_shipping,title,url',
      },
    },
  });

  return response.data;
};

module.exports.getUserData = async (accessToken) => {
  try {
    const response = await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.api+json',
      },
      params: {
        'fields[user]': 'email,full_name,vanity,url,image_url,about,created,first_name,last_name,thumb_url',
        'include': 'memberships,memberships.currently_entitled_tiers,memberships.address',
        'fields[member]': 'full_name,is_follower,last_charge_date,lifetime_support_cents,currently_entitled_amount_cents,patron_status',
        'fields[address]': 'addressee,city,line_1,line_2,phone_number,postal_code,state',
        'fields[tier]': 'amount_cents,created_at,description,discord_role_ids,edited_at,patron_count,published,published_at,requires_shipping,title,url',
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('Unauthorized: Invalid or expired token');
      // Handle token refresh logic here if applicable
    } else {
      console.error('Error fetching user data:', error.message);
    }
    throw error;
  }
}