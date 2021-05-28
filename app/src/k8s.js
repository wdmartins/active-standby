'use strict';

const logger = require('./logger').logger('K8S');

/////////////////////////////////////////////////////////////////////////////////
// Internal constants and variables
/////////////////////////////////////////////////////////////////////////////////

const POD_MODE = Object.freeze({
    ACTIVE: 'active',
    STAND_BY: 'stand-by'
});

// The POD name and the k8s service host
const { HOSTNAME, KUBERNETES_SERVICE_HOST } = process.env;

// The k8s client
let k8sApi;
let contentType;
if (KUBERNETES_SERVICE_HOST) {
    const k8s = require('@kubernetes/client-node');
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    contentType = k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH;
}

// The patch operation skeleton
const patch = {
    op: 'replace',
    path: '/metadata/labels/mode',
    value: null
};

/////////////////////////////////////////////////////////////////////////////////
// Exported Interfaces
/////////////////////////////////////////////////////////////////////////////////

/**
 * Values for pod mode label.
 *
 * @typedef {string} PodMode
 */
exports.POD_MODE = POD_MODE;

/**
 * Sets the pod's label 'mode' matching the esapp stats (active/stand-by).
 *
 * @param {PodMode} value - The value for the pod's label 'mode'.
 */
exports.setMode = function (value) {
    if (!k8sApi) {
        logger.debug(`Not running in Kubernetes. Set mode to ${value} ignored.`);
        return;
    }
    if (value !== POD_MODE.ACTIVE && value !== POD_MODE.STAND_BY) {
        logger.error(`Invalid pod label value: ${value}`);
        return;
    }

    patch.value = value;
    logger.info(`Patch pod ${HOSTNAME} with `, patch);

    const options = { headers: { 'Content-type': contentType } };
    k8sApi.patchNamespacedPod(HOSTNAME, 'default', [patch], undefined, undefined, undefined, undefined, options)
        .then(res => {
            logger.info(`${HOSTNAME} patched successfully. Result: ${res}`);
        })
        .catch(err => {
            logger.error(`Error patching ${HOSTNAME}. Error: ${err}`);
        });
};
