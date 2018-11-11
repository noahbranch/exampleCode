import $ from 'jquery';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { isBlank, isPresent } from '@ember/utils';
import { or } from '@ember/object/computed';

const GOOGLE_KEY = 'AIzaSyCjBOhlC7914uPrWPffPIHZO8mTzcgtkow';

export default Component.extend({
  user: service(),
  notify: service(),

  showSaveConfirmationModal: false,
  isValid: false,
  geoAddress: null,

  modelIsDirty: or('model.hasDirtyAttributes', 'model.organizationSetup.hasDirtyAttributes', 'model.inactiveApplicantSetup.hasDirtyAttributes'),
  fullAddress: computed('model.{address1,address2,city,state,zip}', function() {
    let { address1, address2, city, state, zip } = this.get('model').getProperties('address1', 'address2', 'city', 'state', 'zip');
    if (isBlank(city) && isBlank(state) && isBlank(zip)) {
      return;
    }
    let addr = `${address1 || ''} ${address2 || ''}`.trim();
    if (isBlank(addr)) {
      return `${city || ''}, ${state || ''} ${zip || ''}`.trim();
    }
    return `${addr || ''}, ${city || ''}, ${state || ''} ${zip || ''}`.trim();
  }),

  actions: {
    copyOrgId() {
      let e = document.createElement('input');
      e.value = this.get('model.id');

      document.body.append(e);
      $(e).select();
      document.execCommand('copy');
      e.remove();

      this.get('notify').success('Organization Id copied successfully');
    },

    async save(finalizeSave = false) {
      let geoAddress = await this.getGeoAddress();
      let fullAddress = this.get('fullAddress');

      if (isBlank(fullAddress) || finalizeSave || (geoAddress && geoAddress.fullAddress === fullAddress)) {
        this.attrs.save(this.get('model'));
        this.set('showSaveConfirmationModal', false);
      } else {
        this.set('geoAddress', geoAddress);
        this.set('showSaveConfirmationModal', true);
      }
    },
    cancel() {
      this.attrs.cancel(this.get('model'));
    },
    toggleSaveModal() {
      this.toggleProperty('showSaveConfirmationModal');
    },
    async updateAddress() {
      let geo = this.get('geoAddress');
      if (geo) {
        this.set('model.address1', geo.street);
        this.set('model.address2', geo.address2 || '');
        this.set('model.state', geo.state);
        this.set('model.zip', geo.zip);
        this.set('model.city', geo.city);
        this.attrs.save(this.get('model'));
      }

      this.send('toggleSaveModal');
    }
  },

  async getGeoAddress() {
    let encodedAddr = encodeURIComponent(this.get('fullAddress'));
    if (isPresent(this.get('fullAddress'))) {
      let geo = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=(${encodedAddr})&sensor=false&key=${GOOGLE_KEY}`);
      let geoJson = await geo.json();
      if (geoJson.status !== 'OK') {
        return;
      }

      let [result] = geoJson.results;
      let findField = fieldName => {
        let field = result.address_components.find(x => x.types.includes(fieldName));
        return field && field.short_name;
      };

      return {
        street: `${findField('street_number') || ''} ${findField('route') || ''}`.trim(),
        address2: findField('subpremise'),
        city: findField('locality'),
        state: findField('administrative_area_level_1'),
        zip: findField('postal_code'),
        fullAddress: result.formatted_address.replace(', USA', '')
      };
    }
  }
});
