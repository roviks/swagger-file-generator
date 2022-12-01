import fs from "fs";
let file;
type Method = "get" | "post" | "patch" | "put" | "delete";

const getLinkedSchema = (schema: any) => {
  const resMini: any = [];
  if (schema.$ref) {
    const splitted = schema.$ref.split("/");
    const newSchemaName = splitted[splitted.length - 1];
    resMini.push(newSchemaName);
    return resMini;
  } else if (schema.type === "object") {
    const schemaProperties = schema.properties;
    for (const property of Object.keys(schemaProperties)) {
      const arr = getLinkedSchema(schemaProperties[property]);
      const arr2: any = [];
      for (const schemaName of arr) {
        const splitted = schemaName.split("/");
        const newSchemaName = splitted[splitted.length - 1];
        const newSchema = file.components.schemas[newSchemaName];
        const two = getLinkedSchema(newSchema);
        arr2.push(...two);
      }
      resMini.push(...arr, ...arr2);
    }
    return resMini;
  } else if (schema.type === "array") {
    const splitted = schema.items.$ref.split("/");
    const newSchemaName = splitted[splitted.length - 1];
    resMini.push(newSchemaName);
    return resMini;
  }
  return resMini;
};

const getResponses = (responses) => {
  if (responses.content && responses.content["application/json"]) {
    return responses.schema.$ref.split("/");
  } else if (responses.schema?.$ref) {
    return responses.schema.$ref.split("/");
  }
};

const getPathSchema = (path: Method[], file: any) => {
  let schemas = {};
  for (const method of Object.keys(path)) {
    const bodySplitted =
      path[method].requestBody?.content["application/json"]?.schema?.$ref.split(
        "/"
      );

    if (bodySplitted) {
      const bodySchema = bodySplitted[bodySplitted.length - 1];
      schemas[bodySchema] =
        file.components?.schemas[bodySchema] || file.definitions[bodySchema];
      const linkedBodySchemas: string[] = getLinkedSchema(schemas[bodySchema]);
      linkedBodySchemas.forEach((s) => {
        schemas[s] = file.components?.schemas[s] || file.definitions[s];
      });
    }

    for (const status of Object.keys(path[method]?.responses)) {
      const responsesSplitted = getResponses(path[method].responses[status]);
      if (responsesSplitted === undefined) {
        continue;
      }

      const responsesSchema = responsesSplitted[responsesSplitted.length - 1];
      schemas[responsesSchema] =
        file.components?.schemas[responsesSchema] ||
        file.definitions[responsesSchema];

      const linkedResSchemas: string[] = getLinkedSchema(
        schemas[responsesSchema]
      );

      linkedResSchemas.forEach((s) => {
        schemas[s] = file.components?.schemas[s] || file.definitions[s];
      });

      schemas = {
        ...schemas,
      };
    }
  }

  return schemas;
};

const init = () => {
  const argv = process.argv.slice(2);
  const opts = {
    inputFile: "./swagger.json",
    outputFile: "generated.json",
    includePath: [],
  };

  argv.forEach((arg) => {
    const [key, value] = arg.split("=");

    if (key && value) {
      if (opts[key] !== undefined) {
        let optsValue;
        if (Array.isArray(opts[key])) {
          optsValue = value.split(",");
        } else {
          optsValue = value;
        }

        opts[key] = optsValue;
      }
    }
  });

  let rawInputFile;
  try {
    rawInputFile = fs.readFileSync(opts.inputFile) as any;
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  file = JSON.parse(rawInputFile);

  let json = JSON.parse(JSON.stringify(file));
  json.paths = {} as any;

  if (json.swagger === "2.0") {
    json.definitions = {} as any;
  } else {
    json.components.schemas = {} as any;
  }

  const pathKeys = Object.keys(file.paths);

  for (const path of pathKeys) {
    for (const includePath of opts.includePath) {
      if (path.includes(includePath)) {
        console.log(json.swagger);

        if (json.swagger === "2.0") {
          json.definitions = {
            ...json.definitions,
            ...getPathSchema(file.paths[path], file),
          };
        } else {
          json.components.schemas = {
            ...json.components.schemas,
            ...getPathSchema(file.paths[path], file),
          };
        }

        json.paths = {
          ...json.paths,
          [path]: file.paths[path],
        };
      }
    }
  }

  fs.writeFileSync(opts.outputFile, JSON.stringify(json, null, 2));
};

init();
