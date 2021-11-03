'use strict';

const logger = require('./logger').logger('K8S');

/////////////////////////////////////////////////////////////////////////////////
// Internal constants and variables
/////////////////////////////////////////////////////////////////////////////////
const NAMESPACE = process.env.K8S_NAMESPACE || 'default';

const POD_MODE = Object.freeze({
    ACTIVE: 'active',
    STAND_BY: 'stand-by'
});

// The POD name and the k8s service host
const { HOSTNAME } = process.env;

// The k8s client
const k8s = require('@kubernetes/client-node');
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const contentType = k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH;

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
 * Gets all the App pods matching the given mode label value and phase.
 *
 * @param {string} [mode] - The value of the mode label. If none is provided all App pods are retrieved.
 * @param {string} [phase] - The status phase of the pod, i.e Running, Terminating, etc.
 * @returns {Promise<object>} The name of the pods matching the mode label value, and such mode vale.
 */
exports.getAppPods = async function (mode, phase) {
    try {
        let labelSelector = 'app=app';
        if (mode) {
            labelSelector += `,mode=${mode}`;
        }
        const fieldSelector = phase ? `status.phase=${phase}` : '';
        const result = await k8sApi.listNamespacedPod(NAMESPACE, false, false, '', fieldSelector, labelSelector);
        logger.info('List pods result: ', JSON.stringify(result.body));
        if (result.response.statusCode !== 200) {
            logger.error(`Unable to get pods data. Error: ${result.response.statusCode}`);
            return { ressult: result.response.statusCode, pods: [] };
        }
        result.body.items.forEach(pod => {
            logger.info(`Mode: ${pod.metadata.labels.mode}, statuses: ${JSON.stringify(pod.status.containerStatuses)}`);
        });
        return {
            status: result.response.statusCode,
            pods: result.body.items.map(pod => ({
                name: pod.metadata.name,
                mode: pod.metadata.labels.mode,
                running: !!pod.status.containerStatuses[0].state.running?.startedAt
            })).filter(pod => pod.running)
        };
    } catch (error) {
        logger.error(`Error listing App pods.Error: ${error.text || error.message}`);
        return { status: error };
    }
};


/**
 * Values for pod mode label.
 *
 * @typedef {string} PodMode
 */
exports.POD_MODE = POD_MODE;

/**
 * Sets the pod's label 'mode' matching the app status (active/stand-by).
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

/**
 * Deletes the given pods.
 *
 * @param {Array<string>} pods - The names of the pods to be deleted.
 * @returns {Promise} A promise the resolves to the response or error.
 */
exports.deleteAppPods = async function (pods) {
    let returnValue = 200;
    pods.forEach(async podName => {
        logger.debug(`Deleting pod ${podName}`);
        try {
            const result = await k8sApi.deleteNamespacedPod(podName, NAMESPACE);
            logger.info('Delete pod result: ', result.response.statusCode);
            if (result.response.statusCode !== 200) {
                returnValue = result.response.statusCode;
            }
        } catch (error) {
            logger.error(`Error deleting pod ${podName}. Error: ${error.text || error.message}`);
            returnValue = error;
        }
    });
    return returnValue;
};

