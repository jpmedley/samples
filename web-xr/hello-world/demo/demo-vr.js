/*!
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* eslint-env es6 */

class DemoXR extends Demo {
  constructor () {
    super();

    this._onResize = this._onResize.bind(this);

    this._disabled = false;
    if (typeof XRFrameData === 'undefined') {
      this._disabled = true;
      this._showWebXRNotSupportedError();
      return;
    }

    this._firstXRFrame = false;
    this._button = undefined;
    this._xr = {
      display: null,
      frameData: new XRFrameData()
    };

    this._addXREventListeners();
    this._getDisplays();
  }

  _addXREventListeners () {
    window.addEventListener('xrdisplayactivate', _ => {
      this._activateXR();
    });

    window.addEventListener('xrdisplaydeactivate', _ => {
      this._deactivateXR();
    });
  }

  _getDisplays () {
    return navigator.getXRDisplays().then(displays => {
      // Filter down to devices that can present.
      displays = displays.filter(display => display.capabilities.canPresent);

      // If there are no devices available, quit out.
      if (displays.length === 0) {
        console.warn('No devices available able to present.');
        return;
      }

      // Store the first display we find. A more production-ready version should
      // allow the user to choose from their available displays.
      this._xr.display = displays[0];
      this._xr.display.depthNear = DemoXR.CAMERA_SETTINGS.near;
      this._xr.display.depthFar = DemoXR.CAMERA_SETTINGS.far;

      this._createPresentationButton();
    });
  }

  _showNoPresentError () {
    console.error(`Unable to present with this device ${this._xr.display}`);
  }

  _showWebXRNotSupportedError () {
    console.error('WebXR not supported');
  }

  _createPresentationButton () {
    this._button = document.createElement('button');
    this._button.classList.add('xr-toggle');
    this._button.textContent = 'Enable XR';
    this._button.addEventListener('click', _ => {
      this._toggleXR();
    });
    document.body.appendChild(this._button);
  }

  _deactivateXR () {
    if (!this._xr.display) {
      return;
    }

    if (!this._xr.display.isPresenting) {
      return;
    }

    this._xr.display.exitPresent();
    return;
  }

  _activateXR () {
    if (!this._xr.display) {
      return;
    }

    this._xr.display.requestPresent([{
      source: this._renderer.domElement
    }])
    .catch(e => {
      console.error(`Unable to init XR: ${e}`);
    });
  }

  _toggleXR () {
    if (this._xr.display.isPresenting) {
      return this._deactivateXR();
    }

    return this._activateXR();
  }

  _render () {
    if (this._disabled || !(this._xr.display && this._xr.display.isPresenting)) {
      // Ensure that we switch everything back to auto for non-XR mode.
      this._onResize();
      this._renderer.autoClear = true;
      this._scene.matrixAutoUpdate = true;

      return super._render();
    }

    // When this is called the first time, it will be using the standard
    // window.requestAnimationFrame API, which will throw a warning when we call
    // display.submitFrame. So for the first frame that this is called we will
    // exit early and request a new frame from the XR device instead.
    if (this._firstXRFrame) {
      this._firstXRFrame = false;
      return this._xr.display.requestAnimationFrame(this._update);
    }

    const EYE_WIDTH = this._width * 0.5;
    const EYE_HEIGHT = this._height;

    // Get all the latest data from the XR headset and dump it into frameData.
    this._xr.display.getFrameData(this._xr.frameData);

    // Disable autoupdating because these values will be coming from the
    // frameData data directly.
    this._scene.matrixAutoUpdate = false;

    // Make sure not to clear the renderer automatically, because we will need
    // to render it ourselves twice, once for each eye.
    this._renderer.autoClear = false;

    // Clear the canvas manually.
    this._renderer.clear();

    // Left eye.
    this._renderEye(
      this._xr.frameData.leftViewMatrix,
      this._xr.frameData.leftProjectionMatrix,
      {
        x: 0,
        y: 0,
        w: EYE_WIDTH,
        h: EYE_HEIGHT
      });

    // Ensure that left eye calcs aren't going to interfere with right eye ones.
    this._renderer.clearDepth();

    // Right eye.
    this._renderEye(
      this._xr.frameData.rightViewMatrix,
      this._xr.frameData.rightProjectionMatrix, {
        x: EYE_WIDTH,
        y: 0,
        w: EYE_WIDTH,
        h: EYE_HEIGHT
      });

    // Use the XR display's in-built rAF (which can be a diff refresh rate to
    // the default browser one).
    this._xr.display.requestAnimationFrame(this._update);

    // Call submitFrame to ensure that the device renders the latest image from
    // the WebGL context.
    this._xr.display.submitFrame();
  }

  _renderEye (viewMatrix, projectionMatrix, viewport) {
    // Set the left or right eye half.
    this._renderer.setViewport(viewport.x, viewport.y, viewport.w, viewport.h);

    // Update the scene and camera matrices.
    this._camera.projectionMatrix.fromArray(projectionMatrix);
    this._scene.matrix.fromArray(viewMatrix);

    // Tell the scene to update (otherwise it will ignore the change of matrix).
    this._scene.updateMatrixWorld(true);
    this._renderer.render(this._scene, this._camera);
  }
}

new DemoXR();
