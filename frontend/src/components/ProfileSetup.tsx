'use client';

import { useState } from 'react';
import { UserProfile, ProfileSetupStatus } from '@/hooks/useUserProfile';
import { apiClient } from '@/lib/api';

interface ProfileSetupProps {
  profile: UserProfile | null;
  setupStatus: ProfileSetupStatus;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
}

export function ProfileSetup({ profile, setupStatus, onProfileUpdate }: ProfileSetupProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    linkedinUrl: profile?.linkedin_url || '',
    experiences: profile?.experiences || [],
    skills: profile?.skills || []
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.updateUserBio(formData);
      
      if (response.success && response.data && typeof response.data === 'object' && 'success' in response.data) {
        const data = response.data as { success: boolean; profile: UserProfile };
        if (data.success) {
          onProfileUpdate(data.profile);
          alert('Profile updated successfully!');
        } else {
          alert('Failed to save profile: Server returned error');
        }
      } else {
        alert('Failed to save profile: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addExperience = () => {
    setFormData(prev => ({
      ...prev,
      experiences: [...prev.experiences, { title: '', company: '', duration: '' }]
    }));
  };

  const updateExperience = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      experiences: prev.experiences.map((exp, i) => 
        i === index ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const removeExperience = (index: number) => {
    setFormData(prev => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== index)
    }));
  };

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, '']
    }));
  };

  const updateSkill = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => i === index ? value : skill)
    }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="bg-white shadow rounded-lg">
      
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-6">
          <h3 className="text-lg leading-6 font-medium text-primary mb-2">
            Profile Setup
          </h3>
          
        </div>

        <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* LinkedIn URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn URL *
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skills *
                </label>
                <div className="space-y-2">
                  {formData.skills.map((skill, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateSkill(index, e.target.value)}
                        placeholder="e.g., JavaScript, React, Python"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeSkill(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSkill}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Skill
                  </button>
                </div>
              </div>

              {/* Work Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Experience *
                </label>
                <div className="space-y-3">
                  {formData.experiences.map((exp, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                        <input
                          type="text"
                          value={exp.title || ''}
                          onChange={(e) => updateExperience(index, 'title', e.target.value)}
                          placeholder="Job Title"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={exp.company || ''}
                          onChange={(e) => updateExperience(index, 'company', e.target.value)}
                          placeholder="Company"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={exp.duration || ''}
                        onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                        placeholder="Duration (e.g., Jan 2020 - Present)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeExperience(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove Experience
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExperience}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Experience
                  </button>
                </div>
              </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
