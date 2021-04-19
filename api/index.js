const { get, merge } = require("lodash");
const { defer } = require("rxjs");
const { ajax } = require("rxjs/ajax");
const { pluck, tap } = require("rxjs/operators");
const { XMLHttpRequest } = require("xmlhttprequest");
const fetch = require("node-fetch");

const L = require("../cli/log.js");

const Biz = (init = {}) => {
  const target = { ...init };

  target.api = (x) =>
    defer(() => {
      const method = x.body ? "POST" : "GET";
      const headers = {
        Authorization: `token ${target.token}`,
        "Content-Type": "application/json",
        "User-Agent": "Muranode/1.0.0",
      };
      if (x.url.endsWith("/api:1/token/")) {
        delete headers["Authorization"];
      }

      const options = merge(
        {
          createXHR: () => new XMLHttpRequest(),
          headers,
          method,
        },
        x
      );

      if (
        get(options, "headers.content-type", "").includes("multipart/form-data")
      ) {
        const options = merge(
          {
            headers: {
              authorization: `token ${target.token}`,
            },
          },
          x
        );

        L.log(options);
        return fetch(x.url, options);
      } else {
        L.log(options);
        return ajax(options).pipe(
          tap((x) => L.log(x.status)),
          pluck("response"),
          tap((x) => L.log(JSON.stringify(x))),
          tap(() => L.log())
        );
      }
    });

  const handler = {
    get: (_, service) => {
      const prefix = `https://${_.host}/api:1/`;

      switch (service) {
        case "_":
          return new Proxy(
            {},
            {
              get: (__, k) => _[k],
            }
          );
        case "token":
          return (body) =>
            _.api({
              body,
              url: `${prefix}token/`,
            }).pipe(tap((x) => (_.token = x.token)));
        case "businesses":
          return (x) =>
            _.api({
              url: `${prefix}user/${x.email}/membership/`,
            });
        case "solutions":
          return (x) =>
            _.api({
              url: `${prefix}business/${x.businessId}/solution/`,
            });
        case "serviceConfig":
          return {
            list: (x) =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/serviceconfig`,
              }),
            add: (x) =>
              _.api({
                body: {
                  ...x,
                },
                url: `${prefix}solution/${_.applicationId}/serviceconfig`,
              }),
            update: (x) =>
              _.api({
                body: {
                  parameters: x.parameters,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/serviceconfig/${x.service}`,
              }),
          };
        case "module":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/module`,
              }),
            update: (x) =>
              _.api({
                body: {
                  alias: `${_.applicationId}_${x.name}`,
                  name: x.name,
                  solution_id: _.applicationId,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/module/${_.applicationId}_${x.name}`,
              }),
            delete: (x) =>
              _.api({
                method: "DELETE",
                url: `${prefix}solution/${_.applicationId}/module/${_.applicationId}_${x.name}`,
              }),
          };
        case "fileUpload":
          return (x) =>
            _.api({
              body: x.formData,
              headers: x.formData.getHeaders(),
              method: "PUT",
              url: `${prefix}solution/${
                _.applicationId
              }/fileupload/${x.path.replace(/^\//, "")}`,
            });
        case "endpoint":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/endpoint`,
              }),
            add: (x) =>
              _.api({
                body: {
                  content_type: x.content_type,
                  method: x.method,
                  path: x.path,
                  script: x.script,
                },
                method: "POST",
                url: `${prefix}solution/${_.applicationId}/endpoint`,
              }),
            update: (x) =>
              _.api({
                body: {
                  content_type: x.content_type,
                  method: x.method,
                  path: x.path,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/endpoint/${x.id}`,
              }),
            delete: (x) =>
              _.api({
                method: "DELETE",
                url: `${prefix}solution/${_.applicationId}/endpoint/${x.id}`,
              }),
          };
        case "eventHandler":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/eventhandler`,
              }),
            update: (x) =>
              _.api({
                body: {
                  alias: `${_.applicationId}_${x.name}`,
                  solution_id: _.applicationId,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/eventhandler/${_.applicationId}_${x.name}`,
              }),
          };
        case "exchange":
          return {
            element: () =>
              _.api({
                url: `${prefix}exchange/${_.businessId}/element/`,
              }),
            purchased: () =>
              _.api({
                url: `${prefix}exchange/${_.businessId}/purchase/`,
              }),
            purchase: (x) =>
              _.api({
                body: {
                  elementId: x.elementId,
                  type: "service",
                  solutionId: _.applicationId,
                },
                url: `${prefix}exchange/${_.businessId}/purchase/`,
              }),
          };
        default:
          return new Proxy(
            {
              solutionId: service === "device2" ? _.productId : _.applicationId,
            },
            {
              get: (__, method) => (body) => {
                let url = `${prefix}solution/${
                  __.solutionId
                }/serviceconfig/${service.toLowerCase()}/call/${method}`;
                if (service === "user" && method === "createUserData") {
                  url = `${prefix}solution/${__.solutionId}/user/${body.id}/storage`;
                  delete body.id;
                }
                return _.api({ body, url });
              },
            }
          );
      }
    },
  };

  return new Proxy(target, handler);
};

module.exports = {
  Biz,
};
