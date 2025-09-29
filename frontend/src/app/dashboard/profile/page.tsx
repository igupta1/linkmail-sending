'use client';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile, UserProfile, ProfileSetupStatus } from '@/hooks/useUserProfile';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { profile, isLoading: profileLoading, getProfileSetupStatus, updateProfile } = useUserProfile();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    linkedinUrl: '',
    experiences: [] as any[],
    skills: [] as string[],
    school: '',
    preferences: {} as any
  });
  const [newSkill, setNewSkill] = useState('');
  const [inputWidth, setInputWidth] = useState(75);
  const [colleges, setColleges] = useState<any[]>([]);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [filteredColleges, setFilteredColleges] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        linkedinUrl: profile.linkedin_url || '',
        experiences: profile.experiences || [],
        skills: profile.skills || [],
        school: profile.school || '',
        preferences: profile.preferences || {}
      });
    }
  }, [profile]);

  // Initialize input width based on placeholder
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '14px system-ui, -apple-system, sans-serif';
      const placeholder = formData.skills.length === 0 ? "e.g. Javascript" : "Add another skill...";
      const textWidth = context.measureText(placeholder).width;
      const newWidth = Math.max(75, textWidth + 32);
      setInputWidth(newWidth);
    }
  }, [formData.skills.length]);

  // Load colleges data
  useEffect(() => {
    const loadColleges = async () => {
      try {
        const response = await fetch('/colleges.json');
        const data = await response.json();
        setColleges(data);
      } catch (error) {
        console.error('Error loading colleges:', error);
      }
    };
    loadColleges();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Clean up the data before sending
      const cleanedData = {
        ...formData,
        preferences: Object.keys(formData.preferences).length > 0 ? formData.preferences : null
      };
      
      console.log('Sending profile data:', cleanedData);
      const response = await apiClient.updateUserBio(cleanedData);
      
      if (response.success && response.data && typeof response.data === 'object' && 'success' in response.data) {
        const data = response.data as { success: boolean; profile: UserProfile };
        if (data.success) {
          // Profile will be updated by the hook automatically
          alert('Profile updated successfully!');
        } else {
          alert('Failed to save profile: Server returned error');
        }
      } else {
        console.error('API Error:', response);
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
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
      setInputWidth(75); // Reset to minimum width
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSkillInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewSkill(value);
    
    // Calculate width based on text content
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '14px system-ui, -apple-system, sans-serif'; // Match the input font
      const textWidth = context.measureText(value || e.target.placeholder).width;
      const newWidth = Math.max(75, textWidth + 32); // 16px padding on each side
      setInputWidth(newWidth);
    }
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

  const handleCollegeSearch = (value: string) => {
    setFormData(prev => ({ ...prev, school: value }));
    
    if (value.length > 1) {
      const filtered = colleges
        .filter(college => 
          college.name.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 10); // Limit to 10 results
      setFilteredColleges(filtered);
      setShowCollegeDropdown(true);
    } else {
      setShowCollegeDropdown(false);
    }
  };

  const selectCollege = (college: any) => {
    setFormData(prev => ({ ...prev, school: formatCollegeName(college.name) }));
    setShowCollegeDropdown(false);
  };

  const formatCollegeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/-/g, ' - ') // Add spaces around hyphens
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleCollegeBlur = () => {
    // Delay hiding dropdown to allow for click events
    setTimeout(() => setShowCollegeDropdown(false), 200);
  };

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const setupStatus = getProfileSetupStatus();

  return (
    <div className="max-w-4xl mx-auto py-6 px-6 mt-[100px]">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-newsreader-500 text-gray-900">
              Getting to know you.
            </h1>
            <p className="mt-4 text-[15px] max-w-lg text-stone-500">
              Information about your profile and professional background. This will be used by Linkmail to craft the most personalized emails for you.
            </p>
          </div>
          
          <div className="ml-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-[400px]">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium text-yellow-800">
                  Complete Your Profile
                </h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Your profile is {setupStatus.setupPercentage}% complete. Please add the following information to get started:</p>
                  <ul className="mt-2 list-disc list-inside">
                    {setupStatus.missingFields.map((field, index) => (
                      <li key={index}>{field}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-transparent border border-black/10 rounded-2xl">
        <div className="p-8 sm:p-6">

          <div className="space-y-6 p-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal text-gray-600 mb-3">
                  First Name
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm antialiased text-gray-600 mb-3">
                  Last Name
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* LinkedIn URL */}
            <div>
              <label className="block text-sm font-normal text-gray-600 mb-3">
                Your LinkedIn
              </label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/albert-einstein"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* School */}
            <div className="relative">
              <label className="block text-sm font-normal text-gray-600 mb-3">
                School/University
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => handleCollegeSearch(e.target.value)}
                  onBlur={handleCollegeBlur}
                  onFocus={() => formData.school.length > 1 && setShowCollegeDropdown(true)}
                  placeholder="Start typing to search colleges..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {/* Dropdown */}
                <AnimatePresence>
                  {showCollegeDropdown && filteredColleges.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -20  }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ 
                        delay: 0.1,
                        duration: 0.1,
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                      className="absolute z-10 w-full mt-2 bg-white/10 backdrop-blur-lg p-2 border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {filteredColleges.map((college, index) => (
                        <motion.div
                          key={college.objectid || index}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            duration: 0.15, 
                            delay: index * 0.02,
                            ease: "easeOut"
                          }}
                          className="px-3 py-2 hover:bg-black/5 rounded-lg cursor-pointer"
                          onClick={() => selectCollege(college)}
                          whileHover={{ 
                            transition: { duration: 0.1 }
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="font-medium text-gray-900">{formatCollegeName(college.name)}</div>
                          <div className="text-sm text-gray-500">
                            {formatCollegeName(college.city)}, {college.state}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-normal text-gray-600 mb-3">
                What are your skills?
              </label>
              
              {/* Skills Input and Tags Flow */}
              <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
                {/* Existing Skills Tags */}
                {formData.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-xl text-sm font-medium"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none cursor-pointer"
                      aria-label={`Remove ${skill}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                
                {/* Input Field */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={handleSkillInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={formData.skills.length === 0 ? "e.g. Javascript" : "Add another skill..."}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-out"
                    style={{ width: `${inputWidth}px` }}
                  />
                  <AnimatePresence>
                    {newSkill.trim() && (
                      <motion.button
                        type="button"
                        onClick={addSkill}
                        className="p-1.5 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        initial={{ opacity: 0, scale: 0.8, x: -10 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          x: 0,
                          transition: {
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                          }
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 1, 
                          x: -10,
                          transition: {
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                          }
                        }}
                        whileHover={{ 
                          scale: 1.02,
                          transition: { type: "spring", stiffness: 400, damping: 25 }
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Check className="w-4 h-4" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Work Experience */}
            <div>
              <label className="block text-sm font-normal text-gray-600 mb-3">
                Where have you worked?
              </label>
              <div className="space-y-3">
                {formData.experiences.map((exp, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                      <input
                        type="text"
                        value={exp.title || ''}
                        onChange={(e) => updateExperience(index, 'title', e.target.value)}
                        placeholder="Job Title"
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={exp.company || ''}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                        placeholder="Company"
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <input
                      type="text"
                      value={exp.duration || ''}
                      onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                      placeholder="Duration (e.g., Jan 2020 - Present)"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
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

            {/* Preferences */}
            {/* <div>
              <label className="block text-sm font-normal text-gray-600 mb-3">
                Email Preferences
              </label>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Email Tone</label>
                    <select
                      value={formData.preferences.emailTone || ''}
                      onChange={(e) => handleInputChange('preferences', { ...formData.preferences, emailTone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select tone...</option>
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="friendly">Friendly</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Email Length</label>
                    <select
                      value={formData.preferences.emailLength || ''}
                      onChange={(e) => handleInputChange('preferences', { ...formData.preferences, emailLength: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select length...</option>
                      <option value="short">Short (1-2 paragraphs)</option>
                      <option value="medium">Medium (3-4 paragraphs)</option>
                      <option value="long">Long (5+ paragraphs)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Include Personal Touch</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="personalTouch"
                        value="yes"
                        checked={formData.preferences.personalTouch === 'yes'}
                        onChange={(e) => handleInputChange('preferences', { ...formData.preferences, personalTouch: e.target.value })}
                        className="mr-2"
                      />
                      Yes, include personal details
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="personalTouch"
                        value="no"
                        checked={formData.preferences.personalTouch === 'no'}
                        onChange={(e) => handleInputChange('preferences', { ...formData.preferences, personalTouch: e.target.value })}
                        className="mr-2"
                      />
                      Keep it professional only
                    </label>
                  </div>
                </div>
              </div>
            </div> */}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
