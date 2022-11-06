'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  // Calculate pace min/km
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  // Calculate speed in km/h
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////
//// APPLICATION ARCHITECTURE
//////////////////////////////////////////

// Selecting elements from the DOM
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const workoutOptions = document.querySelector('.workouts-options');
const showAllWorkouts = document.querySelector('.workouts-options__show-all');
const deleteAllWorkouts = document.querySelector(
  '.workouts-options__delete-all'
);
const errorPopup = document.querySelector('.error-popup');
const errorPopupButton = document.querySelector('.error-popup__button');

let editForm,
  editWorkout,
  editInputType,
  editInputDistance,
  editInputDuration,
  editInputCadence,
  editInputElevation;

// Application Class
class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #workoutMarkers = [];

  constructor() {
    // Get current position
    this._getPostion();

    // Get data from localstorage
    this._getLocalStorage();

    // Show delete all
    this._showDeleteAll();

    // Change type of workout
    inputType.addEventListener('change', this._toggleElevationField);

    // Create new work out
    form.addEventListener('submit', this._newWorkOut.bind(this));

    // Click on workouts list to move to popup
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // Edit workout
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));

    // Show all workouts
    showAllWorkouts.addEventListener('click', this._showAllWorkouts.bind(this));

    // Delete workout
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    // Delete all workouts
    deleteAllWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );

    // Close error popup window
    errorPopupButton.addEventListener('click', () =>
      errorPopup.classList.add('hidden')
    );
  }

  _getPostion() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          console.error(
            'Something went wrong. Cannot get your current position.'
          );
        }
      );
  }

  async _geoCode(lat, lng) {
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/reverse?key=pk.a81208a65995996b5e20bd6423597fbb&lat=${lat}&lon=${lng}&format=json`
      );

      const data = await response.json();

      return {
        city: data.address.city,
        country: data.address.country,
      };
    } catch (err) {
      console.error(err);
    }
  }

  _loadMap(positon) {
    const { latitude, longitude } = positon.coords;
    const positionCoords = [latitude, longitude];

    this.#map = L.map('map').setView(positionCoords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map.
    this.#map.on('click', this._showForm.bind(this));

    // Rendering markers on the map.
    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _showAllWorkouts() {
    const group = new L.featureGroup(this.#workoutMarkers);
    this.#map.fitBounds(group.getBounds());
  }

  _showForm(mapEv) {
    // Hide open edit forms
    this._hideEditForms();

    // Clear values of the input fields.
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    this.#mapEvent = mapEv;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Clear values of the input fields.
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    // Hide form
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _showEditForm(editForm) {
    // Show edit form
    editForm.classList.remove('hidden');
    editInputDistance.focus();

    // Submit edit form
    editForm.addEventListener('submit', this._submitEditForm.bind(this));
  }

  _submitEditForm(e) {
    e.preventDefault();

    // Get data from the form inputs.
    const type = editInputType.value;
    const distance = +editInputDistance.value;
    const duration = +editInputDuration.value;
    let cadence, elevation;

    // If activity is running, edit the running object.
    if (type === 'running') {
      cadence = +editInputCadence.value;

      // Check if data is valid.
      if (
        !this.validNumbers(distance, duration, cadence) ||
        !this.allPositive(distance, duration, cadence)
      )
        return this._showError();
    }

    // If activity is cycling, edit the cycling object.
    if (type === 'cycling') {
      elevation = +editInputElevation.value;

      // Check if data is valid.
      if (
        !this.validNumbers(distance, duration, elevation) ||
        !this.allPositive(distance, duration)
      )
        return this._showError();
    }

    // Edited input values
    editWorkout.type = type;
    editWorkout.distance = distance;
    editWorkout.duration = duration;
    editWorkout.cadence = cadence;
    editWorkout.elevation = elevation;

    // Set local storage to all workouts
    this._setLocalStorage();

    // Hide edit form
    this._hideEditForms();

    // Page reload
    location.reload();
  }

  _hideEditForms() {
    // Selecting all workouts that contains edit forms
    const workouts = containerWorkouts.querySelectorAll('.workout');

    // Selecting the edit form
    workouts.forEach(workout => {
      const editForm = workout.childNodes[3];

      // Hiding edit forms
      editForm.classList.add('hidden');
    });
  }

  _toggleElevationField() {
    const inputTypeField = [inputElevation, inputCadence];

    inputTypeField.map(el =>
      el.closest('.form__row').classList.toggle('form__row--hidden')
    );
  }

  _toggleElevationFieldEditForm() {
    const inputTypeField = [editInputCadence, editInputElevation];

    inputTypeField.map(el =>
      el.closest('.form__row').classList.toggle('form__row--hidden')
    );
  }

  _newWorkOut(e) {
    e.preventDefault();

    // Get data from the form inputs.
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    // Initialize workout
    let workout;

    // Map click event coordinates.
    const { lat, lng } = this.#mapEvent.latlng;
    const clickCoords = [lat, lng];

    // If activity is running, create a running object.
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid.
      if (
        !this.validNumbers(distance, duration, cadence) ||
        !this.allPositive(distance, duration, cadence)
      )
        return this._showError();

      // Creating new running workout.
      workout = new Running(clickCoords, distance, duration, cadence);
    }

    // If activity is cycling, create a cycling object.
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // Check if data is valid.
      if (
        !this.validNumbers(distance, duration, elevation) ||
        !this.allPositive(distance, duration)
      )
        return this._showError();

      // Creating new running workout.
      workout = new Cycling(clickCoords, distance, duration, elevation);
    }

    // Add the new object to the workout array.
    this.#workouts.push(workout);

    // Render workout on the map as a marker.
    this._renderWorkoutMarker(workout);

    // Render workout on list.
    this._renderWorkout(workout);

    // Hide form + clear values of the input fields.
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxwidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#workoutMarkers.push(marker);
  }

  async _renderWorkout(workout) {
    // Load geocode
    const geoLocation = await this._geoCode(
      workout.coords[0],
      workout.coords[1]
    );

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">

        <!-- Edit Workout Form -->

        <form class="edit-form hidden" id="edit-form">
          <div class="form__row">
            <label class="form__label">Type</label>
            <select class="form__input edit-form__input--type">
              <option value="running">Running</option>
              <option value="cycling">Cycling</option>
            </select>
          </div>
          <div class="form__row">
            <label class="form__label">Distance</label>
            <input class="form__input edit-form__input--distance" placeholder="km" />
          </div>
          <div class="form__row">
            <label class="form__label">Duration</label>
            <input
              class="form__input edit-form__input--duration"
              placeholder="min"
            />
          </div>
          <div class="form__row">
            <label class="form__label">Cadence</label>
            <input
              class="form__input edit-form__input--cadence"
              placeholder="step/min"
            />
          </div>
          <div class="form__row form__row--hidden">
            <label class="form__label">Elev Gain</label>
            <input
              class="form__input edit-form__input--elevation"
              placeholder="meters"
            />
          </div>
          <button class="form__btn">OK</button>
        </form>


        <div class="workout__edits">
          <span class="workout__icon-edits workout__icon-edits--location">${
            geoLocation.city
          }, <span class="workout__edits-country">${
      geoLocation.country
    }.</span></span>
          <span class="workout__icon-edits workout__icon-edits--edit">📝</span>
          <span class="workout__icon-edits workout__icon-edits--delete">❌</span>
        </div>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
      `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>

      `;

    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;

    form.insertAdjacentHTML('afterend', html);

    // Select edit form inputs
    editInputType = document.querySelector('.edit-form__input--type');
    editInputDistance = document.querySelector('.edit-form__input--distance');
    editInputDuration = document.querySelector('.edit-form__input--duration');
    editInputCadence = document.querySelector('.edit-form__input--cadence');
    editInputElevation = document.querySelector('.edit-form__input--elevation');

    // Load edit form input data
    editInputType.value = workout.type;
    editInputDistance.value = workout.distance;
    editInputDuration.value = workout.duration;

    if (workout.type === 'running') editInputCadence.value = workout.cadence;
    if (workout.type === 'cycling')
      editInputElevation.value = workout.elevationGain;

    // Load type of workout in edit forms
    editInputType.addEventListener(
      'change',
      this._toggleElevationFieldEditForm
    );

    // Show delete all
    this._showDeleteAll();
  }

  _moveToPopup(e) {
    const workOutEl = e.target.closest('.workout');

    if (!workOutEl) return;

    const workout = this.#workouts.find(
      workOut => workOut.id === workOutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    // Set data to local storage
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    // Retrieving data from local storage
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = data;

    // Rendering data on the workout list.
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  _editWorkout(e) {
    // Selecting the edit button
    const editBtn = e.target.closest('.workout__icon-edits--edit');

    if (!editBtn) return;

    // Selecting the workout
    const workOutEl = e.target.closest('.workout');
    editWorkout = this.#workouts.find(
      workOut => workOut.id === workOutEl.dataset.id
    );

    // Closing open forms
    this._hideForm();
    this._hideEditForms();

    // Selecting the edit form and its elements
    editForm = workOutEl.childNodes[3];

    // Display edit form
    this._showEditForm(editForm);
  }

  _deleteWorkout(e) {
    // Seelecting the workout
    const workOutEl = e.target.closest('.workout__icon-edits--delete');

    if (!workOutEl) return;

    const workout = this.#workouts.find(
      workOut => workOut.id === workOutEl.dataset.id
    );

    // Identifying the index position
    const elIndex = this.#workouts.indexOf(workout);

    // Deleting workout
    this.#workouts.splice(elIndex, 1);

    // Persisting to local storage and reload
    this._setLocalStorage();
    location.reload();
  }

  _deleteAllWorkouts() {
    // Deleting all workouts
    this.#workouts = [];

    // Persisting to local storage and reload
    this._setLocalStorage();
    location.reload();
  }

  _showDeleteAll() {
    // Check if there are workouts
    if (this.#workouts.length < 2) return;

    // Show delete all
    workoutOptions.classList.remove('hidden');
  }

  _showError() {
    errorPopup.classList.remove('hidden');
  }

  // Helper function to check if inputs are numbers.
  validNumbers(...numbers) {
    return numbers.every(number => Number.isFinite(number));
  }

  // Helper function to check if inputs are positive numbers.
  allPositive(...numbers) {
    return numbers.every(number => number > 0);
  }

  resetApp() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
