import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { match } from '@ember/object/computed';
import { ProductNames } from '../../utils/enum';

export default Controller.extend({
  notify: service(),
  store: service(),
  user: service(),

  productNames: ProductNames,

  showParentDeleteModal: false,
  showInactivityDeleteModal: false,
  isParentSettings: false,
  isInactivitySettings: false,
  cities: null,
  zips: null,

  isValidColor: match('model.organizationSetup.color', /[0-9a-fA-F]{6}/),

  actions: {
    toggleParent() {
      if (this.toggleProperty('isParentSettings')) {
        this.set('model.organizationSetup', this.get('store').createRecord('organizationSetup', {
          id: this.get('model.id'),
          companyName: this.get('model.name'),
          color: this.get('model.organizationSetup.color'),
          userGroupName: this.get('model.organizationSetup.userGroupName'),
          logoBase64: this.get('model.organizationSetup.logoBase64'),
          logoStaticResourceId: this.get('model.organizationSetup.logoStaticResourceId')
        }));
      } else if (this.get('model.organizationSetup.isNew')) {
        this.send('parentDeleteWarning', true);
      } else {
        this.set('showParentDeleteModal', true);
      }
    },
    toggleInactivity() {
      if (this.toggleProperty('isInactivitySettings')) {
        this.set('model.inactiveApplicantSetup', this.get('store').createRecord('inactiveApplicantSetup', {
          id: this.get('model.id'),
          daysUserInactive: this.get('model.inactiveApplicantSetup.daysUserInactive'),
          daysApplicantInactive: this.get('model.inactiveApplicantSetup.daysApplicantInactive'),
          setupGeneration: this.get('model.inactiveApplicantSetup.setupGeneration')
        }));
      } else if (this.get('model.inactiveApplicantSetup.isNew')) {
        this.send('inactivityDeleteWarning', true);
      } else {
        this.set('showInactivityDeleteModal', true);
      }
    },

    parentDeleteWarning(deleteConfirm) {
      if (deleteConfirm) {
        this.send('updateChild', 'organizationSetup');
      } else {
        this.toggleProperty('isParentSettings');
      }
      this.set('showParentDeleteModal', false);
    },
    inactivityDeleteWarning(deleteConfirm) {
      if (deleteConfirm) {
        this.send('updateChild', 'inactiveApplicantSetup');
      } else {
        this.toggleProperty('isInactivitySettings');
      }
      this.set('showInactivityDeleteModal', false);
    },

    updateChild(childModelName) {
      let childModel = this.get(`model.${childModelName}`);

      if (childModel.get('id') == this.get('user.clientId')) {
        childModel.content.rollbackAttributes();
      } else if (childModel.get('isNew')) {
        childModel.content.unloadRecord();
        this.get('store').queryRecord(childModelName, { orgId: this.get('model.id') }).then(x => this.set(`model.${childModelName}`, x));
      } else {
        childModel.content.destroyRecord().then(() => {
          childModel.content.unloadRecord();
          this.get('store').queryRecord(childModelName, { orgId: this.get('model.id') }).then(x => this.set(`model.${childModelName}`, x));
        });
      }
    },

    save(model) {
      model.save().then(
        org => {
          org.get('organizationSetup.content').rollbackAttributes();
          org.get('inactiveApplicantSetup.content').rollbackAttributes();
          this.get('notify').success('Organization Properties Saved');
        },
        () => this.get('notify').error('Error: Could not save organization properties')
      );
    },
    cancel(model) {
      model.rollbackAttributes();
      let orgSetup = this.get('model.organizationSetup');
      if (orgSetup.get('isNew')) {
        orgSetup.content.unloadRecord();
        this.get('store').queryRecord('organizationSetup', { orgId: this.get('model.id') }).then(x => this.set('model.organizationSetup', x));
      } else {
        model.get('organizationSetup').content.rollbackAttributes();
      }

      let inactiveApplicantSetup = this.get('model.inactiveApplicantSetup');
      if (inactiveApplicantSetup.get('isNew')) {
        inactiveApplicantSetup.content.unloadRecord();
        this.get('store').queryRecord('inactiveApplicantSetup', { orgId: this.get('model.id') }).then(x => this.set('model.inactiveApplicantSetup', x));
      } else {
        model.get('inactiveApplicantSetup').content.rollbackAttributes();
      }

      this.setProperties({
        isParentSettings: model.get('organizationSetup.id') === model.get('id'),
        isInactivitySettings: model.get('inactiveApplicantSetup.id') === model.get('id')
      });

      this.get('notify').success('All properties reset');
    },

    newLogo(file) {
      this.readImage(file, e => {
        let image = e.target.result;
        image = image.replace('data:image/png;base64,', '');
        this.set('model.organizationSetup.logoBase64', image);
      });
    }
  },

  readImage(file, callback) {
    let reader = new FileReader();
    reader.onload = callback;
    reader.readAsDataURL(file.data);
    return file.result;
  }
});
