import { JSONSchema7 } from 'json-schema';

export const generateBambiSleepSchema = () => {
  const schema: JSONSchema7 = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "BambiSleep Content",
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the content related to BambiSleep."
      },
      content: {
        type: "string",
        description: "The main content extracted related to BambiSleep."
      },
      url: {
        type: "string",
        format: "uri",
        description: "The URL where the content was found."
      },
      metadata: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Keywords associated with the content."
          },
          description: {
            type: "string",
            description: "A brief description of the content."
          },
          categories: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Categories under which the content is classified."
          },
          created: {
            type: "string",
            format: "date-time",
            description: "The date and time when the content was created."
          }
        },
        required: ["keywords", "description", "categories", "created"]
      }
    },
    required: ["title", "content", "url", "metadata"]
  };

  return schema;
};